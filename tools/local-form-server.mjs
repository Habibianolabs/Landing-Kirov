import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.PORT || 8000);
const maxRequestBytes = 16_384;
const mimeTypes = {
  ".css": "text/css; charset=UTF-8", ".gif": "image/gif", ".html": "text/html; charset=UTF-8",
  ".ico": "image/x-icon", ".jpeg": "image/jpeg", ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=UTF-8", ".json": "application/json; charset=UTF-8",
  ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp"
};

function cleanString(value, maxLength) {
  return String(value ?? "").replace(/[\0\r\n]/g, "").trim().slice(0, maxLength);
}

function normalizeApplication(body) {
  return {
    name: cleanString(body.name, 120), phone: cleanString(body.phone, 32),
    email: cleanString(body.email, 160).toLowerCase(), source: cleanString(body.source, 80) || "unknown",
    plan: cleanString(body.plan, 40), website: cleanString(body.website, 120),
    formStartedAt: Number.parseInt(body.form_started_at, 10) || 0,
    consent: [true, "true", "on", "1", 1].includes(body.consent)
  };
}

function validateApplication(application) {
  if (application.name.length < 2) return "Укажите имя и фамилию.";
  if (!/^\+?[0-9()\s-]{7,32}$/.test(application.phone)) return "Проверьте номер телефона.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(application.email)) return "Проверьте e-mail.";
  if (!application.consent) return "Нужно согласие на обработку персональных данных.";
  if (application.plan && !["Оптима", "Корпоратив"].includes(application.plan)) return "Неизвестный тариф.";
  return null;
}

function jsonResponse(response, status, body) {
  response.writeHead(status, { "Cache-Control": "no-store", "Content-Type": "application/json; charset=UTF-8",
    "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" });
  response.end(status === 204 ? "" : JSON.stringify(body));
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxRequestBytes) throw new Error("REQUEST_TOO_LARGE");
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new Error("INVALID_JSON"); }
}

function testEmailConfiguration() {
  if (process.env.APPLICATION_ENV !== "testing") throw new Error("Локальный сервер запускается только с APPLICATION_ENV=testing.");
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.RESEND_FROM_EMAIL || "").trim();
  const recipients = String(process.env.APPLICATION_RECIPIENTS || "").split(",").map((item) => item.trim()).filter(Boolean);
  if (!apiKey || !from || recipients.length !== 1 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipients[0])) {
    throw new Error("Для локального теста нужны RESEND_API_KEY, RESEND_FROM_EMAIL и один APPLICATION_RECIPIENTS.");
  }
  return { apiKey, from, recipient: recipients[0] };
}

function emailPayload(application, configuration) {
  const plan = application.plan || "не выбран";
  const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
  })[character]);
  return {
    from: configuration.from, to: [configuration.recipient], reply_to: application.email,
    subject: `Новая заявка G10 Киров — ${application.name}`,
    text: ["Новая заявка на участие в G10 Киров.", "", `Имя: ${application.name}`,
      `Телефон: ${application.phone}`, `E-mail: ${application.email}`, `Тариф: ${plan}`,
      `Источник формы: ${application.source}`].join("\n"),
    html: `<h2>Новая заявка на участие в G10 Киров</h2>`
      + `<p><strong>Имя:</strong> ${escapeHtml(application.name)}</p>`
      + `<p><strong>Телефон:</strong> ${escapeHtml(application.phone)}</p>`
      + `<p><strong>E-mail:</strong> ${escapeHtml(application.email)}</p>`
      + `<p><strong>Тариф:</strong> ${escapeHtml(plan)}</p>`
      + `<p><strong>Источник формы:</strong> ${escapeHtml(application.source)}</p>`
  };
}

async function sendApplication(application) {
  const configuration = testEmailConfiguration();
  const response = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${configuration.apiKey}`,
      "Content-Type": "application/json", "User-Agent": "G10-Kirov-Local-Test/1.0" },
    body: JSON.stringify(emailPayload(application, configuration)), signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) console.error(`Resend rejected the local test email with HTTP ${response.status}.`);
  return response.ok;
}

async function handleApplication(request, response) {
  if (request.method === "OPTIONS") return jsonResponse(response, 204, {});
  if (request.method !== "POST") return jsonResponse(response, 405, { ok: false, message: "Метод не поддерживается." });
  let body;
  try { body = await readJsonBody(request); }
  catch (error) {
    const tooLarge = error.message === "REQUEST_TOO_LARGE";
    return jsonResponse(response, tooLarge ? 413 : 400, { ok: false,
      message: tooLarge ? "Заявка слишком большая." : "Некорректный формат заявки." });
  }
  const application = normalizeApplication(body);
  if (application.website) return jsonResponse(response, 200, { ok: true });
  const validationMessage = validateApplication(application);
  if (validationMessage) return jsonResponse(response, 400, { ok: false, message: validationMessage });
  if (application.formStartedAt > 0) {
    const formAge = Math.floor(Date.now() / 1000) - application.formStartedAt;
    if (formAge < 2) return jsonResponse(response, 429, { ok: false, message: "Подождите пару секунд и отправьте форму ещё раз." });
    if (formAge > 86_400) return jsonResponse(response, 400, { ok: false, message: "Форма устарела. Обновите страницу и заполните её снова." });
  }
  try {
    if (!await sendApplication(application)) throw new Error("SEND_FAILED");
  } catch (error) {
    if (error.message !== "SEND_FAILED") console.error(error.message);
    return jsonResponse(response, 503, { ok: false, message: "Не удалось принять заявку. Попробуйте ещё раз позже." });
  }
  return jsonResponse(response, 200, { ok: true });
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
  const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const pathSegments = pathname.split("/").filter(Boolean);
  if (pathSegments.some((segment) => segment.startsWith(".")) || ["api", "tools"].includes(pathSegments[0])) {
    return response.writeHead(404, { "Content-Type": "text/plain; charset=UTF-8" }).end("Not found");
  }
  const filePath = resolve(projectRoot, `.${pathname}`);
  if (filePath !== projectRoot && !filePath.startsWith(projectRoot + sep)) return response.writeHead(403).end("Forbidden");
  try {
    const contents = await readFile(filePath);
    response.writeHead(200, { "Cache-Control": "no-store", "Content-Type": mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream" });
    response.end(contents);
  } catch { response.writeHead(404, { "Content-Type": "text/plain; charset=UTF-8" }).end("Not found"); }
}

export function createLocalServer() {
  return createServer((request, response) => {
    const pathname = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`).pathname;
    if (pathname === "/api/submit-application.php") {
      handleApplication(request, response).catch(() => jsonResponse(response, 500, { ok: false, message: "Внутренняя ошибка." }));
    } else serveStatic(request, response);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createLocalServer().listen(port, "127.0.0.1", () => console.log(`G10 Kirov local test: http://127.0.0.1:${port}`));
}
