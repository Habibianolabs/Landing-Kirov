import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { connect as connectTls } from "node:tls";

const HOST = "127.0.0.1";
const PORT = 4173;
const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const SMTP_HOST = "smtp.yandex.ru";
const SMTP_PORT = 465;
const SMTP_USERNAME = "event@restoranoff.ru";
const TEST_RECIPIENT = "nikitaodintsov6@gmail.com";
const MAX_REQUEST_BYTES = 16_384;

const MIME_TYPES = {
  ".css": "text/css; charset=UTF-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=UTF-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=UTF-8",
  ".json": "application/json; charset=UTF-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

class SmtpSession {
  constructor(socket) {
    this.socket = socket;
    this.buffer = "";
    this.pending = [];
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      this.buffer += chunk;
      this.flush();
    });
    socket.on("error", (error) => this.fail(error));
    socket.on("close", () => this.fail(new Error("SMTP-соединение закрыто.")));
  }

  fail(error) {
    while (this.pending.length) this.pending.shift().reject(error);
  }

  flush() {
    while (this.pending.length) {
      const match = this.buffer.match(/^(?:(\d{3})-[^\r\n]*\r\n)*(\d{3}) ([^\r\n]*)\r\n/);
      if (!match) return;
      const response = match[0];
      this.buffer = this.buffer.slice(response.length);
      const code = Number(match[2]);
      this.pending.shift().resolve({ code, response });
    }
  }

  read() {
    return new Promise((resolveResponse, reject) => {
      this.pending.push({ resolve: resolveResponse, reject });
      this.flush();
    });
  }

  async command(command, expectedCodes) {
    if (command !== null) this.socket.write(`${command}\r\n`);
    const result = await this.read();
    if (!expectedCodes.includes(result.code)) {
      throw new Error(`SMTP отклонил команду: ${result.code}.`);
    }
    return result;
  }
}

function encodeHeader(value) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

async function sendApplication(password, application) {
  const socket = connectTls({
    host: SMTP_HOST,
    port: SMTP_PORT,
    servername: SMTP_HOST,
    rejectUnauthorized: true,
  });
  const session = new SmtpSession(socket);

  try {
    await new Promise((resolveConnect, reject) => {
      socket.once("secureConnect", resolveConnect);
      socket.once("error", reject);
    });
    await session.command(null, [220]);
    await session.command("EHLO localhost", [250]);
    await session.command("AUTH LOGIN", [334]);
    await session.command(Buffer.from(SMTP_USERNAME).toString("base64"), [334]);
    await session.command(Buffer.from(password).toString("base64"), [235]);
    await session.command(`MAIL FROM:<${SMTP_USERNAME}>`, [250]);
    await session.command(`RCPT TO:<${TEST_RECIPIENT}>`, [250, 251]);
    await session.command("DATA", [354]);

    const subject = `ЛОКАЛЬНЫЙ SMTP-ТЕСТ G10 Киров — ${application.name}`;
    const body = [
      "Локальная тестовая заявка с лендинга G10 Киров.",
      "",
      `Имя: ${application.name}`,
      `Телефон: ${application.phone}`,
      `E-mail: ${application.email}`,
      `Тариф: ${application.plan || "не выбран"}`,
      `Источник формы: ${application.source || "unknown"}`,
      "",
      "Получатель этой проверки: только nikitaodintsov6@gmail.com.",
    ].join("\r\n");
    const message = [
      `From: ${encodeHeader("G10 Киров")} <${SMTP_USERNAME}>`,
      `To: <${TEST_RECIPIENT}>`,
      `Reply-To: ${application.email}`,
      `Subject: ${encodeHeader(subject)}`,
      "Date: " + new Date().toUTCString(),
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(body, "utf8").toString("base64").replace(/.{1,76}/g, "$&\r\n").trimEnd(),
      ".",
    ].join("\r\n");
    socket.write(`${message}\r\n`);
    await session.command(null, [250]);
    await session.command("QUIT", [221]);
  } finally {
    socket.destroy();
  }
}

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=UTF-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

function clean(value, maxLength) {
  return String(value ?? "").replace(/[\0\r\n]/g, "").trim().slice(0, maxLength);
}

function normalizeApplication(body) {
  return {
    name: clean(body.name, 120),
    phone: clean(body.phone, 32),
    email: clean(body.email, 160).toLowerCase(),
    source: clean(body.source, 80),
    plan: clean(body.plan, 40),
    website: clean(body.website, 120),
    consent: [true, "true", "on", "1", 1].includes(body.consent),
  };
}

function validationError(application) {
  if (application.name.length < 2) return "Укажите имя и фамилию.";
  if (!/^\+?[0-9()\s-]{7,32}$/.test(application.phone)) return "Проверьте номер телефона.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(application.email)) return "Проверьте e-mail.";
  if (!application.consent) return "Нужно согласие на обработку персональных данных.";
  if (application.plan && !["Оптима", "Корпоратив"].includes(application.plan)) return "Неизвестный тариф.";
  return null;
}

async function readJson(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_REQUEST_BYTES) throw new Error("Заявка слишком большая.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function staticPath(url) {
  const pathname = decodeURIComponent(new URL(url, `http://${HOST}:${PORT}`).pathname);
  const requested = pathname === "/" ? "/index.html" : pathname;
  const path = normalize(join(PROJECT_ROOT, requested));
  return path.startsWith(`${PROJECT_ROOT}/`) ? path : null;
}

let smtpPassword = "";

const setupPage = `<!doctype html>
<html lang="ru">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Локальная проверка G10</title>
<style>
  body{font:18px/1.5 system-ui,sans-serif;max-width:620px;margin:60px auto;padding:0 24px;color:#161616}
  label{display:block;font-weight:700;margin:24px 0 8px}input,button{box-sizing:border-box;width:100%;font:inherit;padding:14px;border-radius:10px}
  input{border:1px solid #777}button{margin-top:16px;border:0;background:#111;color:#fff;font-weight:700;cursor:pointer}
  small{display:block;color:#555;margin-top:12px}.ok{padding:18px;background:#e7f7ea;border-radius:12px}
</style>
<h1>Локальная проверка заявок</h1>
<p>Введите пароль приложения Яндекса. Он останется только во временной памяти локального процесса и не будет записан в файлы или GitHub.</p>
<form method="post" action="/__smtp-setup" autocomplete="off">
  <label for="password">Пароль приложения</label>
  <input id="password" name="password" type="password" required autofocus autocomplete="new-password">
  <button type="submit">Начать локальную проверку</button>
</form>
<small>Страница доступна только на этом компьютере по адресу 127.0.0.1.</small>`;

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/__smtp-setup") {
    response.writeHead(200, { "Content-Type": "text/html; charset=UTF-8", "Cache-Control": "no-store" });
    response.end(setupPage);
    return;
  }

  if (request.method === "POST" && request.url === "/__smtp-setup") {
    try {
      let body = "";
      for await (const chunk of request) {
        body += chunk;
        if (body.length > 1024) throw new Error("Слишком длинное значение.");
      }
      const password = new URLSearchParams(body).get("password")?.trim() || "";
      if (!password) throw new Error("Пароль не введён.");
      smtpPassword = password;
      response.writeHead(303, { Location: "/__smtp-ready", "Cache-Control": "no-store" });
      response.end();
    } catch {
      response.writeHead(400, { "Content-Type": "text/plain; charset=UTF-8", "Cache-Control": "no-store" });
      response.end("Пароль не принят. Вернитесь назад и повторите ввод.");
    }
    return;
  }

  if (request.method === "GET" && request.url === "/__smtp-ready") {
    response.writeHead(200, { "Content-Type": "text/html; charset=UTF-8", "Cache-Control": "no-store" });
    response.end(`${setupPage.split("<form")[0]}<p class="ok">Пароль принят только на время проверки. <a href="/">Открыть локальный лендинг</a>.</p>`);
    return;
  }

  if (request.method === "POST" && request.url === "/api/submit-application.php") {
    try {
      if (!smtpPassword) return json(response, 503, { ok: false, message: "Сначала откройте локальную страницу настройки почты." });
      const body = await readJson(request);
      const application = normalizeApplication(body);
      if (application.website) return json(response, 200, { ok: true });
      const error = validationError(application);
      if (error) return json(response, 400, { ok: false, message: error });
      await sendApplication(smtpPassword, application);
      console.log(`[${new Date().toLocaleTimeString("ru-RU")}] SMTP принял тестовое письмо для ${TEST_RECIPIENT}.`);
      return json(response, 200, { ok: true });
    } catch (error) {
      console.error(`[${new Date().toLocaleTimeString("ru-RU")}] Отправка не удалась: ${error.message}`);
      return json(response, 503, { ok: false, message: "Не удалось отправить тестовую заявку." });
    }
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405).end();
    return;
  }

  const path = staticPath(request.url);
  if (!path || !existsSync(path) || !statSync(path).isFile()) {
    response.writeHead(404).end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": MIME_TYPES[extname(path).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  if (request.method === "HEAD") response.end();
  else createReadStream(path).pipe(response);
});

server.listen(PORT, HOST, () => {
  console.log(`Настройка локальной проверки: http://${HOST}:${PORT}/__smtp-setup`);
  console.log(`Тестовые заявки отправляются только на ${TEST_RECIPIENT}.`);
  console.log("Для остановки нажмите Control+C.");
});

process.on("SIGINT", () => {
  smtpPassword = "";
  console.log("\nЛокальная проверка остановлена. Пароль удалён из памяти процесса.");
  server.close(() => process.exit(0));
});
