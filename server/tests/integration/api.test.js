import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/laundry_test?replicaSet=rs0";
process.env.SESSION_SECRET = "integration-test-session-secret-0123456789";
process.env.UPLOAD_DIR = join(tmpdir(), `washday-test-uploads-${process.pid}`);
if (!/^mongodb:\/\/(localhost|127\.0\.0\.1):\d+\/laundry_test\?replicaSet=rs0$/.test(process.env.MONGODB_URI)) {
  throw new Error("Integration tests only run against the local laundry_test replica set.");
}

let baseUrl;
let server;
let app;
let resident;
let residentSecondSession;
let neighbor;
let itemId;
let laundryEventId;

async function call(client, method, path, body, headers = {}) {
  const requestHeaders = new Headers(headers);
  if (client.cookie) requestHeaders.set("Cookie", client.cookie);
  if (!client.csrf && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    throw new Error("Call csrf(client) before making a state-changing request.");
  }
  if (client.csrf && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    requestHeaders.set("X-CSRF-Token", client.csrf);
  }
  let payload = body;
  if (body !== undefined && !(body instanceof FormData)) {
    requestHeaders.set("Content-Type", "application/json");
    payload = JSON.stringify(body);
  }
  const response = await fetch(`${baseUrl}/api${path}`, { method, headers: requestHeaders, body: payload });
  const cookies = response.headers.getSetCookie?.() ?? [];
  if (cookies.length) client.cookie = cookies.at(-1).split(";")[0];
  const data = response.status === 204 ? null : await response.json();
  return { response, data };
}

async function csrf(client) {
  const { response, data } = await call(client, "GET", "/auth/csrf");
  assert.equal(response.status, 200);
  client.csrf = data.csrfToken;
}

async function register(client, username) {
  await csrf(client);
  const beforeRotation = client.cookie;
  const result = await call(client, "POST", "/auth/register", {
    username,
    password: "washday-passphrase-2026",
  });
  assert.equal(result.response.status, 201);
  assert.notEqual(client.cookie, beforeRotation, "registration should rotate the session cookie");
  client.csrf = "";
  await csrf(client);
  return result.data.user;
}

before(async () => {
  const { connectDatabase } = await import("../../src/config/database.js");
  await connectDatabase();
  ({ app } = await import("../../src/app.js"));
  server = createServer(app);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  resident = { cookie: "", csrf: "" };
  residentSecondSession = { cookie: "", csrf: "" };
  neighbor = { cookie: "", csrf: "" };
});

after(async () => {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  if (app?.locals.sessionStore) await app.locals.sessionStore.close();
  const { closeDatabase } = await import("../../src/config/database.js");
  await closeDatabase();
  await rm(process.env.UPLOAD_DIR, { recursive: true, force: true });
});

test("registration requires CSRF and rotates the session", async () => {
  const signedOut = await call(resident, "GET", "/auth/me?token=must-not-be-logged");
  assert.equal(signedOut.response.status, 200);
  assert.match(signedOut.response.headers.get("x-request-id"), /^[0-9a-f-]{36}$/i);
  assert.equal(signedOut.data.user, null);

  await csrf(resident);
  const rejected = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: resident.cookie },
    body: JSON.stringify({ username: "hostel_user", password: "washday-passphrase-2026" }),
  });
  assert.equal(rejected.status, 403);
  const rejectionBody = await rejected.json();
  assert.equal(rejectionBody.error.requestId, rejected.headers.get("x-request-id"));

  const residentName = `resident_${randomUUID().slice(0, 8)}`;
  const neighborName = `neighbor_${randomUUID().slice(0, 8)}`;
  const residentUser = await register(resident, residentName);
  assert.equal(residentUser.username, residentName);
  const current = await call(resident, "GET", "/auth/me");
  assert.equal(current.data.user.id, residentUser.id);

  await register(neighbor, neighborName);
});

test("clothing routes require login and keep inventory owner-scoped", async () => {
  const anonymous = await call({ cookie: "", csrf: "" }, "GET", "/clothes");
  assert.equal(anonymous.response.status, 401);

  const created = await call(resident, "POST", "/clothes", { name: "Blue shirt", category: "Shirt" });
  assert.equal(created.response.status, 201);
  itemId = created.data.item._id;

  const neighborItems = await call(neighbor, "GET", "/clothes");
  assert.equal(neighborItems.data.items.length, 0);
  const crossAccountMutation = await call(neighbor, "POST", `/clothes/${itemId}/missing`, {});
  assert.equal(crossAccountMutation.response.status, 409);
});

test("archiving a clothing item removes its private photo", async () => {
  const form = new FormData();
  form.set("name", "Archive photo test");
  form.set("category", "Shirt");
  form.set("photo", new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: "image/png" }), "shirt.png");
  const created = await call(resident, "POST", "/clothes", form);
  assert.equal(created.response.status, 201);
  const photoKey = created.data.item.photoKey;
  assert.ok(photoKey);
  await readFile(join(process.env.UPLOAD_DIR, photoKey));

  const privatePhoto = await fetch(`${baseUrl}/api/clothes/${created.data.item._id}/photo`, { headers: { Cookie: resident.cookie } });
  assert.equal(privatePhoto.status, 200);
  assert.equal(privatePhoto.headers.get("content-type"), "image/png");
  assert.equal(privatePhoto.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(Buffer.from(await privatePhoto.arrayBuffer()), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  const neighborPhoto = await fetch(`${baseUrl}/api/clothes/${created.data.item._id}/photo`, { headers: { Cookie: neighbor.cookie } });
  assert.equal(neighborPhoto.status, 404);
  assert.equal((await neighborPhoto.json()).error.code, "PHOTO_NOT_FOUND");

  const archived = await call(resident, "DELETE", `/clothes/${created.data.item._id}`);
  assert.equal(archived.response.status, 200);
  assert.equal(archived.data.item.photoKey, null);
  await assert.rejects(readFile(join(process.env.UPLOAD_DIR, photoKey)), { code: "ENOENT" });
  const photo = await call(resident, "GET", `/clothes/${created.data.item._id}/photo`);
  assert.equal(photo.response.status, 404);
});

test("photo uploads reject spoofed, unsupported, oversized, and overfilled multipart requests", async () => {
  const invalidSignature = new FormData();
  invalidSignature.set("name", "Spoofed image");
  invalidSignature.set("category", "Shirt");
  invalidSignature.set("photo", new Blob(["not an image"], { type: "image/png" }), "spoof.png");
  const spoofed = await call(resident, "POST", "/clothes", invalidSignature);
  assert.equal(spoofed.response.status, 400);
  assert.equal(spoofed.data.error.code, "INVALID_IMAGE");

  const unsupportedMime = new FormData();
  unsupportedMime.set("name", "Unsupported media");
  unsupportedMime.set("category", "Shirt");
  unsupportedMime.set("photo", new Blob(["plain text"], { type: "text/plain" }), "notes.txt");
  const unsupported = await call(resident, "POST", "/clothes", unsupportedMime);
  assert.equal(unsupported.response.status, 400);
  assert.equal(unsupported.data.error.code, "INVALID_IMAGE");

  const oversized = new FormData();
  oversized.set("name", "Oversized image");
  oversized.set("category", "Shirt");
  oversized.set("photo", new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: "image/png" }), "large.png");
  const tooLarge = await call(resident, "POST", "/clothes", oversized);
  assert.equal(tooLarge.response.status, 413);
  assert.equal(tooLarge.data.error.code, "FILE_TOO_LARGE");

  const tooManyFields = new FormData();
  tooManyFields.set("name", "Extra multipart fields");
  tooManyFields.set("category", "Shirt");
  tooManyFields.set("unexpected", "unbounded field");
  const excessive = await call(resident, "POST", "/clothes", tooManyFields);
  assert.equal(excessive.response.status, 400);
  assert.equal(excessive.data.error.code, "INVALID_UPLOAD");
});

test("MongoDB rate-limit stores share atomic counters across instances", async () => {
  const { MongoRateLimitStore } = await import("../../src/middleware/mongoRateLimitStore.js");
  const prefix = `integration.${randomUUID()}:`;
  const separatePrefix = `${prefix}other:`;
  const first = new MongoRateLimitStore({ prefix });
  const second = new MongoRateLimitStore({ prefix });
  const separate = new MongoRateLimitStore({ prefix: separatePrefix });
  await Promise.all([first.init({ windowMs: 60_000 }), second.init({ windowMs: 60_000 })]);
  await separate.init({ windowMs: 60_000 });

  const increments = await Promise.all(Array.from({ length: 20 }, (_, index) =>
    (index % 2 === 0 ? first : second).increment("127.0.0.1")));
  assert.deepEqual(increments.map(({ totalHits }) => totalHits).sort((a, b) => a - b), Array.from({ length: 20 }, (_, index) => index + 1));
  assert.equal((await second.get("127.0.0.1")).totalHits, 20);
  const storedCounter = await first.collection.findOne({ storePrefix: prefix });
  assert.match(storedCounter._id.slice(prefix.length), /^[a-f\d]{64}$/);
  assert.equal(storedCounter._id.includes("127.0.0.1"), false);

  await first.decrement("127.0.0.1");
  assert.equal((await second.get("127.0.0.1")).totalHits, 19);
  await second.resetKey("127.0.0.1");
  assert.equal(await first.get("127.0.0.1"), undefined);

  await first.increment("one");
  await second.increment("two");
  await separate.increment("keep");
  await first.resetAll();
  assert.equal(await second.get("one"), undefined);
  assert.equal(await second.get("two"), undefined);
  assert.equal((await separate.get("keep")).totalHits, 1);
  await separate.resetAll();

  const expiring = new MongoRateLimitStore({ prefix: `${prefix}expiry:` });
  await expiring.init({ windowMs: 50 });
  const firstWindow = await expiring.increment("client");
  await new Promise((resolve) => setTimeout(resolve, 100));
  const nextWindow = await expiring.increment("client");
  assert.equal(nextWindow.totalHits, 1);
  assert.ok(nextWindow.resetTime > firstWindow.resetTime);
  await expiring.resetAll();
});

test("laundry cycles update item status and history as one workflow", async () => {
  const currentDay = new Intl.DateTimeFormat("en", { weekday: "long" }).format(new Date());
  const schedule = await call(resident, "PATCH", "/profile/schedule", { laundryDays: [currentDay] });
  assert.equal(schedule.response.status, 200);

  const sent = await call(resident, "POST", "/laundry", { itemIds: [itemId] });
  assert.equal(sent.response.status, 201);

  const overview = await call(resident, "GET", "/laundry");
  const event = overview.data.history.find((record) => record.item?._id === itemId);
  assert.ok(event);
  assert.equal(event.status, "pending");
  laundryEventId = event._id;

  const duplicate = await call(resident, "POST", "/laundry", { itemIds: [itemId] });
  assert.equal(duplicate.response.status, 409);

  const returned = await call(resident, "POST", `/laundry/${laundryEventId}/return`, {});
  assert.equal(returned.response.status, 200);
  const closet = await call(resident, "GET", "/clothes");
  assert.equal(closet.data.items.find((item) => item._id === itemId).status, "available");
  assert.ok(closet.data.items.find((item) => item._id === itemId).lastWashedAt);
});

test("concurrent laundry requests cannot create two active cycles for one item", async () => {
  const created = await call(resident, "POST", "/clothes", { name: "Concurrent request shirt", category: "Shirt" });
  assert.equal(created.response.status, 201);
  const concurrentItemId = created.data.item._id;
  const body = { itemIds: [concurrentItemId] };

  const results = await Promise.all([
    call(resident, "POST", "/laundry", body),
    call(resident, "POST", "/laundry", body),
  ]);
  assert.deepEqual(results.map(({ response }) => response.status).sort(), [201, 409]);

  const overview = await call(resident, "GET", "/laundry");
  const activeEvents = overview.data.history.filter((event) => event.item?._id === concurrentItemId && event.status === "pending");
  assert.equal(activeEvents.length, 1);
  const returned = await call(resident, "POST", `/laundry/${activeEvents[0]._id}/return`, {});
  assert.equal(returned.response.status, 200);
});

test("photo uploads are limited per account across the daily window", async () => {
  const uploader = { cookie: "", csrf: "" };
  const username = `upload_${randomUUID().slice(0, 8)}`;
  await register(uploader, username);

  for (let index = 0; index < 31; index += 1) {
    const form = new FormData();
    form.set("name", "Daily photo quota item");
    form.set("category", "Shirt");
    form.set("photo", new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: "image/png" }), `quota-${index}.png`);
    const result = await call(uploader, "POST", "/clothes", form);
    if (index === 0) assert.equal(result.response.status, 201);
    else if (index < 30) assert.equal(result.response.status, 409);
    else {
      assert.equal(result.response.status, 429);
      assert.equal(result.data.error.code, "PHOTO_UPLOAD_LIMIT");
    }
  }

  const deleted = await call(uploader, "DELETE", "/profile/account", { currentPassword: "washday-passphrase-2026" });
  assert.equal(deleted.response.status, 204);
});

test("account data can be exported and account deletion removes owned records", async () => {
  const accountPhoto = new FormData();
  accountPhoto.set("name", "Delete account photo test");
  accountPhoto.set("category", "Shirt");
  accountPhoto.set("photo", new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: "image/png" }), "account.png");
  const photoItem = await call(resident, "POST", "/clothes", accountPhoto);
  assert.equal(photoItem.response.status, 201);
  const accountPhotoKey = photoItem.data.item.photoKey;
  await readFile(join(process.env.UPLOAD_DIR, accountPhotoKey));

  const passwordUpdate = await call(resident, "PATCH", "/profile/password", {
    currentPassword: "washday-passphrase-2026",
    newPassword: "washday-updated-passphrase-2026",
    confirmPassword: "washday-updated-passphrase-2026",
  });
  assert.equal(passwordUpdate.response.status, 200);
  const exportResult = await call(resident, "GET", "/profile/export");
  assert.equal(exportResult.response.status, 200);
  assert.equal(exportResult.data.account.username.startsWith("resident_"), true);
  assert.ok(exportResult.data.items.some((item) => item.name === "Blue shirt"));
  assert.ok(exportResult.data.laundryEvents.some((event) => event.item === itemId));

  await csrf(residentSecondSession);
  const secondLogin = await call(residentSecondSession, "POST", "/auth/login", {
    username: exportResult.data.account.username,
    password: "washday-updated-passphrase-2026",
  });
  assert.equal(secondLogin.response.status, 200);
  residentSecondSession.csrf = "";
  await csrf(residentSecondSession);

  const wrongPassword = await call(resident, "DELETE", "/profile/account", { currentPassword: "wrong-password" });
  assert.equal(wrongPassword.response.status, 400);

  const deleted = await call(resident, "DELETE", "/profile/account", { currentPassword: "washday-updated-passphrase-2026" });
  assert.equal(deleted.response.status, 204);
  await assert.rejects(readFile(join(process.env.UPLOAD_DIR, accountPhotoKey)), { code: "ENOENT" });
  const signedOut = await call(resident, "GET", "/auth/me");
  assert.equal(signedOut.data.user, null);
  const revokedSession = await call(residentSecondSession, "GET", "/clothes");
  assert.equal(revokedSession.response.status, 401);
  const neighborItems = await call(neighbor, "GET", "/clothes");
  assert.equal(neighborItems.response.status, 200);
  assert.equal(neighborItems.data.items.length, 0);
});
