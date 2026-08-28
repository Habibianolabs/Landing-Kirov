import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const php = await readFile(new URL("../api/submit-application.php", import.meta.url), "utf8");

test("production PHP sends applications only through Telegram", () => {
  assert.match(php, /api\.telegram\.org/);
  assert.match(php, /sendMessage/);
  assert.match(php, /G10_TELEGRAM_BOT_TOKEN/);
  assert.match(php, /G10_TELEGRAM_CHAT_ID/);
  assert.doesNotMatch(php, /PHPMailer|G10_SMTP_|smtp\.yandex\.ru|@?mail\(/i);
});

test("Telegram secrets are read from server settings and not hardcoded", () => {
  assert.match(php, /environment_value\('G10_TELEGRAM_BOT_TOKEN'\)/);
  assert.match(php, /environment_value\('G10_TELEGRAM_CHAT_ID'\)/);
  assert.doesNotMatch(php, /\d{8,12}:[A-Za-z0-9_-]{20,}/);
});

test("Telegram request has a bounded timeout and verifies the API result", () => {
  assert.match(php, /CURLOPT_TIMEOUT\s*=>\s*5/);
  assert.match(php, /CURLOPT_POST\s*=>\s*true/);
  assert.match(php, /empty\(\$decoded\['ok'\]\)/);
  assert.match(php, /response_json\(503/);
});
