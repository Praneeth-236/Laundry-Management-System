import assert from "node:assert/strict";
import test from "node:test";
import { requestContext } from "../src/middleware/requestContext.js";

test("request context returns a correlation ID and logs only the path, method, status, and duration", () => {
  const headers = {};
  const listeners = {};
  const req = { method: "GET", path: "/api/auth/me", url: "/api/auth/me?token=must-not-be-logged" };
  const res = {
    statusCode: 200,
    setHeader(name, value) { headers[name] = value; },
    on(name, callback) { listeners[name] = callback; },
  };
  let forwarded = false;
  const originalInfo = console.info;
  let logged;
  console.info = (line) => { logged = JSON.parse(line); };
  try {
    requestContext(req, res, () => { forwarded = true; });
    assert.equal(forwarded, true);
    assert.match(req.requestId, /^[0-9a-f-]{36}$/i);
    assert.equal(headers["X-Request-ID"], req.requestId);
    listeners.finish();
  } finally {
    console.info = originalInfo;
  }
  assert.deepEqual(logged, {
    level: "info",
    event: "http_request",
    requestId: req.requestId,
    method: "GET",
    path: "/api/auth/me",
    status: 200,
    durationMs: logged.durationMs,
  });
  assert.equal(Number.isInteger(logged.durationMs), true);
});
