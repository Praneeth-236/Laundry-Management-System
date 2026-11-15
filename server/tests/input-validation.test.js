import test from "node:test";
import assert from "node:assert/strict";
import {
  categorySchema,
  clothingItemSchema,
  credentialsSchema,
  objectIdSchema,
  passwordChangeSchema,
  scheduleSchema,
  sendLaundrySchema,
} from "../src/validation/schemas.js";

test("credentials accept a normalized username and a long passphrase", () => {
  const result = credentialsSchema.parse({ username: " sam_1 ", password: "correct horse battery" });
  assert.equal(result.username, "sam_1");
});

test("credentials reject short passwords and non-ASCII values over bcrypt's byte limit", () => {
  assert.equal(credentialsSchema.safeParse({ username: "sam", password: "too-short" }).success, false);
  assert.equal(credentialsSchema.safeParse({ username: "sam", password: "é".repeat(37) }).success, false);
});

test("strict clothing and category schemas reject unexpected properties", () => {
  assert.equal(clothingItemSchema.safeParse({ name: "Shirt", category: "Tops", owner: "other-user" }).success, false);
  assert.equal(categorySchema.safeParse({ name: "Sportswear", extra: true }).success, false);
});

test("ObjectIds must have exactly 24 hexadecimal characters", () => {
  assert.equal(objectIdSchema.safeParse("0123456789abcdef01234567").success, true);
  assert.equal(objectIdSchema.safeParse("not-an-id").success, false);
});

test("laundry batches are bounded and cannot contain duplicate items", () => {
  const id = "0123456789abcdef01234567";
  assert.equal(sendLaundrySchema.safeParse({ itemIds: [id] }).success, true);
  assert.equal(sendLaundrySchema.safeParse({ itemIds: [id, id] }).success, false);
  assert.equal(sendLaundrySchema.safeParse({ itemIds: [] }).success, false);
});

test("laundry schedule accepts valid weekdays and rejects unknown ones", () => {
  assert.equal(scheduleSchema.safeParse({ laundryDays: ["Monday", "Thursday"] }).success, true);
  assert.equal(scheduleSchema.safeParse({ laundryDays: ["Someday"] }).success, false);
});

test("password changes require confirmation to match", () => {
  const body = { currentPassword: "old password", newPassword: "new password long", confirmPassword: "new password long" };
  assert.equal(passwordChangeSchema.safeParse(body).success, true);
  assert.equal(passwordChangeSchema.safeParse({ ...body, confirmPassword: "different password" }).success, false);
});
