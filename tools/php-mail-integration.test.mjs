import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const capturedMessages = [];
let smtpServer;
let phpServer;
let endpoint;

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server.address().port;
}

async function availablePort() {
  const server = createServer();
  const port = await listen(server);
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function createMockSmtpServer() {
  return createServer((socket) => {
    socket.setEncoding("utf8");
    socket.write("220 localhost G10 test SMTP\r\n");
    let buffer = "";
    let dataMode = false;
    let dataLines = [];
    let envelopeFrom = "";
    let recipient = "";

    socket.on("data", (chunk) => {
      buffer += chunk;
      let lineEnd;
      while ((lineEnd = buffer.indexOf("\r\n")) !== -1) {
        const line = buffer.slice(0, lineEnd);
        buffer = buffer.slice(lineEnd + 2);

        if (dataMode) {
          if (line === ".") {
            capturedMessages.push({
              envelopeFrom,
              recipient,
              raw: dataLines.map((item) => item.startsWith("..") ? item.slice(1) : item).join("\r\n")
            });
            dataMode = false;
            dataLines = [];
            socket.write("250 2.0.0 queued\r\n");
          } else {
            dataLines.push(line);
          }
          continue;
        }

        if (/^(EHLO|HELO)\b/i.test(line)) {
          socket.write("250-localhost\r\n250-8BITMIME\r\n250 PIPELINING\r\n");
        } else if (/^MAIL FROM:/i.test(line)) {
          envelopeFrom = line;
          recipient = "";
          socket.write("250 2.1.0 sender accepted\r\n");
        } else if (/^RCPT TO:/i.test(line)) {
          recipient = line;
          socket.write("250 2.1.5 recipient accepted\r\n");
        } else if (/^DATA$/i.test(line)) {
          dataMode = true;
          dataLines = [];
          socket.write("354 end with <CRLF>.<CRLF>\r\n");
        } else if (/^RSET$/i.test(line)) {
          envelopeFrom = "";
          recipient = "";
          socket.write("250 2.0.0 reset\r\n");
        } else if (/^NOOP$/i.test(line)) {
          socket.write("250 2.0.0 ok\r\n");
        } else if (/^QUIT$/i.test(line)) {
          socket.end("221 2.0.0 bye\r\n");
        } else {
          socket.write("500 5.5.2 command not recognized\r\n");
        }
      }
    });
  });
}

async function waitForServer(url) {
  let lastError;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(url, { method: "OPTIONS" });
      if (response.status === 204) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`PHP test server did not start: ${lastError?.message ?? "unknown error"}`);
}

function decodedBody(rawMessage) {
  const separator = rawMessage.indexOf("\r\n\r\n");
  assert.notEqual(separator, -1, "Expected an email header/body separator");
  const body = rawMessage.slice(separator + 4).replace(/\s+/g, "");
  return Buffer.from(body, "base64").toString("utf8");
}

before(async () => {
  smtpServer = createMockSmtpServer();
  const smtpPort = await listen(smtpServer);
  const phpPort = await availablePort();
  endpoint = `http://127.0.0.1:${phpPort}/api/submit-application.php`;
  phpServer = spawn("php", ["-S", `127.0.0.1:${phpPort}`, "-t", projectRoot], {
    env: {
      ...process.env,
      G10_SMTP_HOST: "127.0.0.1",
      G10_SMTP_PORT: String(smtpPort),
      G10_SMTP_ENCRYPTION: "none",
      G10_SMTP_AUTH: "0"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  await waitForServer(endpoint);
});

after(async () => {
  if (phpServer && !phpServer.killed) phpServer.kill("SIGTERM");
  if (smtpServer) await new Promise((resolve) => smtpServer.close(resolve));
});

test("the production endpoint validates malformed applications", async () => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    ok: false,
    message: "Укажите имя и фамилию."
  });
});

test("the production endpoint delivers one SMTP message to every configured recipient", async () => {
  const marker = `${Date.now()}-${process.pid}`;
  const application = {
    name: `Тест SMTP ${marker}`,
    phone: "+7 (999) 123-45-67",
    email: `integration-${marker}@example.com`,
    source: "github-smtp-integration-test",
    plan: "Оптима",
    website: "",
    form_started_at: Math.floor(Date.now() / 1000) - 3,
    consent: "on"
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://g10.kirov.restoved.ru"
    },
    body: JSON.stringify(application)
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });

  assert.equal(capturedMessages.length, 5);
  const expectedRecipients = [
    "lp@restoranoff.ru",
    "rv@restoranoff.ru",
    "event@restoranoff.ru",
    "p.spiridonova@restoranoff.ru",
    "nikitaodintsov6@gmail.com"
  ];

  for (const recipient of expectedRecipients) {
    const matching = capturedMessages.filter((message) => message.recipient.includes(`<${recipient}>`));
    assert.equal(matching.length, 1, `Expected exactly one SMTP message for ${recipient}`);
    const message = matching[0];
    assert.ok(message.envelopeFrom.includes("<event@restoranoff.ru>"));
    assert.match(message.raw, /From: .* <event@restoranoff\.ru>/);
    assert.ok(message.raw.includes(`To: ${recipient}`));
    assert.match(message.raw, /Reply-To:/);
    assert.ok(message.raw.includes(`<${application.email}>`));
    const body = decodedBody(message.raw);
    assert.ok(body.includes(`Имя: ${application.name}`));
    assert.ok(body.includes(`Телефон: ${application.phone}`));
    assert.ok(body.includes(`E-mail: ${application.email}`));
    assert.ok(body.includes("Тариф: Оптима"));
    assert.ok(body.includes("Источник формы: github-smtp-integration-test"));
  }
});
