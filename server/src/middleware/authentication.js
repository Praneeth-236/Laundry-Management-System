import { HttpError } from "../utils/httpError.js";

export function requireAuthentication(req, _res, next) {
  if (!req.session.userId) {
    return next(new HttpError(401, "Sign in to continue.", "AUTHENTICATION_REQUIRED"));
  }
  next();
}
