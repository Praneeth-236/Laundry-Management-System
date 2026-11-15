import test from "node:test";
import assert from "node:assert/strict";
import { protectAgainstCsrf } from "../src/middleware/csrf.js";
import { requireAuthentication } from "../src/middleware/authentication.js";

function request(method, token, session = {}) {
  return {
    method,
    session,
    get(name) { return name.toLowerCase() === "x-csrf-token" ? token : undefined; },
  };
}

test("CSRF protection allows safe reads without a token", () => {
  let forwarded;
  protectAgainstCsrf(request("GET"), {}, (error) => { forwarded = error; });
  assert.equal(forwarded, undefined);
});

test("CSRF protection rejects a state change with no session token", () => {
  let forwarded;
  protectAgainstCsrf(request("POST", undefined), {}, (error) => { forwarded = error; });
  assert.equal(forwarded.status, 403);
  assert.equal(forwarded.code, "CSRF_TOKEN_MISSING");
});

test("CSRF protection rejects a token that does not match the session", () => {
  let forwarded;
  protectAgainstCsrf(request("DELETE", "wrong-token", { csrfToken: "expected-token" }), {}, (error) => { forwarded = error; });
  assert.equal(forwarded.status, 403);
  assert.equal(forwarded.code, "CSRF_TOKEN_INVALID");
});

test("CSRF protection allows a matching session token", () => {
  let forwarded;
  protectAgainstCsrf(request("PATCH", "same-token", { csrfToken: "same-token" }), {}, (error) => { forwarded = error; });
  assert.equal(forwarded, undefined);
});

test("private API middleware rejects anonymous sessions", () => {
  let forwarded;
  requireAuthentication(request("GET", undefined), {}, (error) => { forwarded = error; });
  assert.equal(forwarded.status, 401);
  assert.equal(forwarded.code, "AUTHENTICATION_REQUIRED");
});

test("private API middleware accepts an authenticated session", () => {
  let forwarded;
  requireAuthentication(request("GET", undefined, { userId: "user-123" }), {}, (error) => { forwarded = error; });
  assert.equal(forwarded, undefined);
});
