import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const captureScript = join(projectRoot, "tools", "capture-mail.php");
let captureDirectory;
let phpServer;
let endpoint;

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
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

before(async () => {
  captureDirectory = await mkdtemp(join(tmpdir(), "g10-mail-capture-"));
  const port = await availablePort();
  endpoint = `http://127.0.0.1:${port}/api/submit-application.php`;
  phpServer = spawn(
    "php",
    [
      "-d",
      `sendmail_path=php ${captureScript}`,
      "-S",
      `127.0.0.1:${port}`,
      "-t",
      projectRoot
    ],
    {
      env: { ...process.env, MAIL_CAPTURE_DIR: captureDirectory },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
  await waitForServer(endpoint);
});

after(async () => {
  if (phpServer && !phpServer.killed) phpServer.kill("SIGTERM");
  if (captureDirectory) await rm(captureDirectory, { recursive: true, force: true });
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

test("the production endpoint creates one correct email for every customer recipient", async () => {
  const marker = `${Date.now()}-${process.pid}`;
  const application = {
    name: `Тест GitHub ${marker}`,
    phone: "+7 (999) 123-45-67",
    email: `integration-${marker}@example.com`,
    source: "github-php-integration-test",
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

  const files = (await readdir(captureDirectory)).filter((file) => file.endsWith(".eml"));
  assert.equal(files.length, 4);
  const messages = await Promise.all(files.map((file) => readFile(join(captureDirectory, file), "utf8")));
  const expectedRecipients = [
    "lp@restoranoff.ru",
    "rv@restoranoff.ru",
    "event@restoranoff.ru",
    "p.spiridonova@restoranoff.ru"
  ];

  for (const recipient of expectedRecipients) {
    const matching = messages.filter((message) => message.includes(`To: ${recipient}`));
    assert.equal(matching.length, 1, `Expected exactly one message for ${recipient}`);
    const message = matching[0];
    assert.match(message, /From: .* <event@restoranoff\.ru>/);
    assert.ok(message.includes(`Reply-To: ${application.email}`));
    assert.ok(message.includes(`Имя: ${application.name}`));
    assert.ok(message.includes(`Телефон: ${application.phone}`));
    assert.ok(message.includes(`E-mail: ${application.email}`));
    assert.ok(message.includes("Тариф: Оптима"));
    assert.ok(message.includes("Источник формы: github-php-integration-test"));
  }
});
