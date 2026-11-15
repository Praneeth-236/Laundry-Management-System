import { randomBytes, timingSafeEqual } from "node:crypto";
import { HttpError } from "../utils/httpError.js";

const stateChangingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function issueCsrfToken(req, res) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = randomBytes(32).toString("hex");
  }
  res.json({ csrfToken: req.session.csrfToken });
}

export function protectAgainstCsrf(req, _res, next) {
  if (!stateChangingMethods.has(req.method)) return next();

  const expected = req.session.csrfToken;
  const received = req.get("x-csrf-token");
  if (!expected || !received) {
    return next(new HttpError(403, "Reload the page and try that action again.", "CSRF_TOKEN_MISSING"));
  }

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
    return next(new HttpError(403, "Reload the page and try that action again.", "CSRF_TOKEN_INVALID"));
  }
  next();
}
