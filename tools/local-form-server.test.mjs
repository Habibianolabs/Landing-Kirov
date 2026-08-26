import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "node:http";
import { createLocalServer } from "./local-form-server.mjs";

let mockPayload;
const mockResend = createServer((request, response) => {
  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", () => {
    mockPayload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    response.writeHead(200, { "Content-Type": "application/json" }).end('{"id":"test-email"}');
  });
});
const localServer = createLocalServer();

before(async () => {
  process.env.APPLICATION_ENV = "testing";
  process.env.APPLICATION_RECIPIENTS = "test-recipient@example.com";
  process.env.RESEND_API_KEY = "test-only-key";
  process.env.RESEND_FROM_EMAIL = "G10 Test <test@example.com>";
  await new Promise((resolve) => mockResend.listen(0, "127.0.0.1", resolve));
  process.env.RESEND_API_URL = `http://127.0.0.1:${mockResend.address().port}`;
  await new Promise((resolve) => localServer.listen(0, "127.0.0.1", resolve));
});

after(async () => Promise.all([
  new Promise((resolve) => localServer.close(resolve)),
  new Promise((resolve) => mockResend.close(resolve))
]));

const endpoint = (path = "/api/submit-application.php") => `http://127.0.0.1:${localServer.address().port}${path}`;

test("serves the landing locally", async () => {
  const response = await fetch(endpoint("/"));
  assert.equal(response.status, 200);
  assert.match(await response.text(), /G10/);
});

test("never serves local secrets", async () => {
  const response = await fetch(endpoint("/.env.local"));
  assert.equal(response.status, 404);
});

test("rejects an invalid application", async () => {
  const response = await fetch(endpoint(), { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, message: "Укажите имя и фамилию." });
});

test("sends a valid application to the configured test recipient", async () => {
  const response = await fetch(endpoint(), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Локальный тест", phone: "+7 900 000-00-00",
      email: "applicant@example.com", source: "automated-local-test", plan: "Оптима",
      consent: "on", form_started_at: Math.floor(Date.now() / 1000) - 3 })
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.deepEqual(mockPayload.to, ["test-recipient@example.com"]);
  assert.equal(mockPayload.reply_to, "applicant@example.com");
  assert.match(mockPayload.subject, /Локальный тест/);
  assert.match(mockPayload.text, /\+7 900 000-00-00/);
});
