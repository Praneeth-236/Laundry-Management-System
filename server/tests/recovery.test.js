import test from "node:test";
import assert from "node:assert/strict";
import { hashRecoveryToken, issueRecoveryToken, RECOVERY_TOKEN_LIFETIME_MS } from "../src/services/recoveryTokens.js";
import { createEmailService } from "../src/services/emailService.js";

test("recovery tokens are random, URL-safe, hashed, and expire after 30 minutes", () => {
  const now = 1_800_000_000_000;
  const first = issueRecoveryToken(now);
  const second = issueRecoveryToken(now);
  assert.match(first.token, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first.token, second.token);
  assert.equal(first.hash, hashRecoveryToken(first.token));
  assert.notEqual(first.hash, first.token);
  assert.equal(first.expiresAt.getTime(), now + RECOVERY_TOKEN_LIFETIME_MS);
});

test("email delivery is disabled without a host and does not send", async () => {
  const service = createEmailService({ appUrl: "https://washday.example" });
  assert.equal(service.enabled, false);
  assert.equal(await service.sendVerification({ email: "resident@example.test", username: "resident", token: "token" }), false);
});

test("verification and reset emails use HTTPS links with tokens in fragments", async () => {
  const messages = [];
  const service = createEmailService({
    host: "smtp.example.test",
    from: "Washday <no-reply@example.test>",
    appUrl: "https://washday.example/",
    transporter: { sendMail: async (message) => messages.push(message) },
  });
  assert.equal(service.enabled, true);
  await service.sendVerification({ email: "resident@example.test", username: "resident", token: "verify-token" });
  await service.sendPasswordReset({ email: "resident@example.test", username: "resident", token: "reset-token" });
  assert.equal(messages.length, 2);
  assert.match(messages[0].text, /https:\/\/washday\.example\/verify-email#verify-token/);
  assert.match(messages[1].text, /https:\/\/washday\.example\/reset-password#reset-token/);
  assert.equal(messages[0].to, "resident@example.test");
});
