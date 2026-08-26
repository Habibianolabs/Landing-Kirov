import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const php = await readFile(new URL("../api/submit-application.php", import.meta.url), "utf8");

test("production PHP uses the server mail function without external email services", () => {
  assert.match(php, /@mail\(/);
  assert.doesNotMatch(php, /Resend|RESEND_API_KEY|api\.resend\.com/i);
});

test("production PHP contains all approved customer recipients", () => {
  for (const recipient of [
    "lp@restoranoff.ru",
    "rv@restoranoff.ru",
    "event@restoranoff.ru",
    "p.spiridonova@restoranoff.ru"
  ]) {
    assert.match(php, new RegExp(recipient.replace(".", "\\.")));
  }
});

test("production PHP uses the approved sender and applicant Reply-To", () => {
  assert.match(php, /const MAIL_FROM = 'event@restoranoff\.ru'/);
  assert.match(php, /'Reply-To: ' \. \$application\['email'\]/);
});
