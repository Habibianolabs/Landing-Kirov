import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const php = await readFile(new URL("../api/submit-application.php", import.meta.url), "utf8");

test("production PHP uses authenticated SMTP instead of the server mail function", () => {
  assert.match(php, /smtp\.yandex\.ru/);
  assert.match(php, /PHPMailer/);
  assert.match(php, /G10_SMTP_PASSWORD/);
  assert.doesNotMatch(php, /@mail\(/);
  assert.doesNotMatch(php, /Resend|RESEND_API_KEY|api\.resend\.com/i);
});

test("production PHP contains all configured customer and temporary test recipients", () => {
  for (const recipient of [
    "lp@restoranoff.ru",
    "rv@restoranoff.ru",
    "event@restoranoff.ru",
    "p.spiridonova@restoranoff.ru",
    "nikitaodintsov6@gmail.com"
  ]) {
    assert.match(php, new RegExp(recipient.replace(".", "\\.")));
  }
});

test("production PHP uses the approved sender and applicant Reply-To", () => {
  assert.match(php, /const MAIL_FROM = 'event@restoranoff\.ru'/);
  assert.match(php, /addReplyTo\(\$application\['email'\]/);
});
