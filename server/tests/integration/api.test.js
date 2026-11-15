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
  const signedOut = await call(resident, "GET", "/auth/me");
  assert.equal(signedOut.response.status, 200);
  assert.equal(signedOut.data.user, null);

  await csrf(resident);
  const rejected = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: resident.cookie },
    body: JSON.stringify({ username: "hostel_user", password: "washday-passphrase-2026" }),
  });
  assert.equal(rejected.status, 403);

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

  const archived = await call(resident, "DELETE", `/clothes/${created.data.item._id}`);
  assert.equal(archived.response.status, 200);
  assert.equal(archived.data.item.photoKey, null);
  await assert.rejects(readFile(join(process.env.UPLOAD_DIR, photoKey)), { code: "ENOENT" });
  const photo = await call(resident, "GET", `/clothes/${created.data.item._id}/photo`);
  assert.equal(photo.response.status, 404);
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

test("account data can be exported and account deletion removes owned records", async () => {
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
  const signedOut = await call(resident, "GET", "/auth/me");
  assert.equal(signedOut.data.user, null);
  const revokedSession = await call(residentSecondSession, "GET", "/clothes");
  assert.equal(revokedSession.response.status, 401);
  const neighborItems = await call(neighbor, "GET", "/clothes");
  assert.equal(neighborItems.response.status, 200);
  assert.equal(neighborItems.data.items.length, 0);
});
