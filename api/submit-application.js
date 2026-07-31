const { createHash } = require("node:crypto");

const MEMORY_BUCKETS = new Map();
const DEFAULT_RATE_LIMIT_MAX = 5;
const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 600;
const DEFAULT_RECIPIENTS = [
  "lp@restoranoff.ru",
  "rv@restoranoff.ru",
  "event@restoranoff.ru",
  "p.spiridonova@restoranoff.ru"
];

function numberFromEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getRateLimitConfig() {
  return {
    max: numberFromEnv("RATE_LIMIT_MAX", DEFAULT_RATE_LIMIT_MAX),
    windowSeconds: numberFromEnv("RATE_LIMIT_WINDOW_SECONDS", DEFAULT_RATE_LIMIT_WINDOW_SECONDS)
  };
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return String(req.headers["x-real-ip"] || "unknown").trim();
}

function fingerprint(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function setCommonHeaders(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
}

function respond(res, status, body, headers = {}) {
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  return res.status(status).json(body);
}

function getMemoryRateLimit(key, config) {
  const now = Date.now();
  for (const [bucketKey, bucket] of MEMORY_BUCKETS) {
    if (bucket.resetAt <= now) MEMORY_BUCKETS.delete(bucketKey);
  }
  const current = MEMORY_BUCKETS.get(key);
  if (!current || current.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + config.windowSeconds * 1000 };
    MEMORY_BUCKETS.set(key, bucket);
    return { allowed: true, count: bucket.count, resetAt: bucket.resetAt, mode: "memory" };
  }
  current.count += 1;
  return { allowed: current.count <= config.max, count: current.count, resetAt: current.resetAt, mode: "memory" };
}

async function getRedisRateLimit(key, config) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (process.env.VERCEL === "1" || process.env.NODE_ENV === "production") throw new Error("Production rate limiter is not configured");
    return getMemoryRateLimit(key, config);
  }

  const response = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, config.windowSeconds]
    ])
  });
  if (!response.ok) throw new Error("Rate limiter request failed");
  const result = await response.json();
  const count = Number(result?.[0]?.result);
  if (!Number.isFinite(count)) throw new Error("Rate limiter response invalid");
  return {
    allowed: count <= config.max,
    count,
    resetAt: Date.now() + config.windowSeconds * 1000,
    mode: "upstash"
  };
}

async function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16 * 1024) throw new Error("Request too large");
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

function cleanString(value, maxLength) {
  return String(value || "").trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, maxLength);
}

function normalizeApplication(body) {
  const name = cleanString(body.name, 120);
  const phone = cleanString(body.phone, 32);
  const email = cleanString(body.email, 160).toLowerCase();
  const source = cleanString(body.source, 80) || "unknown";
  const plan = cleanString(body.plan, 40);
  const website = cleanString(body.website, 120);
  const turnstileToken = cleanString(body.turnstileToken, 4096);
  const consent = [true, "true", "on", "1"].includes(body.consent);
  return { name, phone, email, source, plan, website, turnstileToken, consent };
}

function validateApplication(application) {
  if (application.website) return { honeypot: true };
  if (application.name.length < 2) return { message: "Укажите имя и фамилию." };
  if (!/^\+?[0-9()\s-]{7,32}$/.test(application.phone)) return { message: "Проверьте номер телефона." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(application.email)) return { message: "Проверьте e-mail." };
  if (!application.consent) return { message: "Нужно согласие на обработку персональных данных." };
  if (application.plan && !["Оптима", "Корпоратив"].includes(application.plan)) return { message: "Неизвестный тариф." };
  return null;
}

async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret, response: token, remoteip: ip })
  });
  if (!response.ok) return false;
  const result = await response.json();
  return result.success === true;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[character]));
}

function getRecipients() {
  const configured = String(process.env.APPLICATION_RECIPIENTS || "").split(",").map((value) => value.trim()).filter(Boolean);
  return configured.length ? configured : DEFAULT_RECIPIENTS;
}

async function sendApplicationEmail(application) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Email provider is not configured");

  const subject = `Новая заявка G10 Киров — ${application.name}`;
  const text = [
    "Новая заявка на участие в G10 Киров.",
    `Имя: ${application.name}`,
    `Телефон: ${application.phone}`,
    `E-mail: ${application.email}`,
    `Тариф: ${application.plan || "не выбран"}`,
    `Источник формы: ${application.source}`
  ].join("\n");
  const html = `<h2>Новая заявка на участие в G10 Киров</h2><p><strong>Имя:</strong> ${escapeHtml(application.name)}</p><p><strong>Телефон:</strong> ${escapeHtml(application.phone)}</p><p><strong>E-mail:</strong> ${escapeHtml(application.email)}</p><p><strong>Тариф:</strong> ${escapeHtml(application.plan || "не выбран")}</p><p><strong>Источник формы:</strong> ${escapeHtml(application.source)}</p>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: getRecipients(), reply_to: application.email, subject, text, html })
  });
  if (!response.ok) throw new Error("Email provider rejected the message");
}

module.exports = async function handler(req, res) {
  setCommonHeaders(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return respond(res, 405, { ok: false, message: "Метод не поддерживается." }, { Allow: "POST, OPTIONS" });

  let application;
  try {
    application = normalizeApplication(await parseBody(req));
  } catch (error) {
    return respond(res, 400, { ok: false, message: "Некорректный формат заявки." });
  }

  const validation = validateApplication(application);
  if (validation?.honeypot) return respond(res, 200, { ok: true });
  if (validation) return respond(res, 400, { ok: false, message: validation.message });

  const ip = getClientIp(req);
  const config = getRateLimitConfig();
  let rateLimit;
  try {
    rateLimit = await getRedisRateLimit(`g10-application:${fingerprint(ip)}`, config);
  } catch (error) {
    return respond(res, 503, { ok: false, message: "Сервис временно недоступен. Попробуйте ещё раз позже." });
  }
  const rateHeaders = {
    "X-RateLimit-Limit": String(config.max),
    "X-RateLimit-Remaining": String(Math.max(0, config.max - rateLimit.count)),
    "X-RateLimit-Mode": rateLimit.mode
  };
  if (!rateLimit.allowed) {
    const retryAfter = Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000));
    return respond(res, 429, { ok: false, message: "Слишком много попыток. Попробуйте позже." }, { ...rateHeaders, "Retry-After": String(retryAfter) });
  }

  try {
    if (!(await verifyTurnstile(application.turnstileToken, ip))) return respond(res, 400, { ok: false, message: "Антиспам-проверка не пройдена." }, rateHeaders);
    await sendApplicationEmail(application);
    return respond(res, 200, { ok: true }, rateHeaders);
  } catch (error) {
    return respond(res, 503, { ok: false, message: "Не удалось принять заявку. Попробуйте ещё раз позже." }, rateHeaders);
  }
};
