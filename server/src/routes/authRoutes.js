import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { asyncRoute } from "../middleware/asyncRoute.js";
import { issueCsrfToken } from "../middleware/csrf.js";
import { currentUser, login, logout, register } from "../controllers/authController.js";
import { MongoRateLimitStore } from "../middleware/mongoRateLimitStore.js";
import { requireAuthentication } from "../middleware/authentication.js";
import { requestEmailVerification, requestPasswordReset, resetPassword, verifyEmail } from "../controllers/recoveryController.js";

export const authRoutes = Router();

const signInLimiter = rateLimit({
  store: new MongoRateLimitStore({ prefix: "washday:auth:" }),
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "TOO_MANY_ATTEMPTS", message: "Too many sign-in attempts. Try again later." } },
});
const recoveryLimiter = rateLimit({
  store: new MongoRateLimitStore({ prefix: "washday:recovery:" }),
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "TOO_MANY_ATTEMPTS", message: "Too many recovery attempts. Try again later." } },
});

authRoutes.get("/csrf", issueCsrfToken);
authRoutes.get("/me", asyncRoute(currentUser));
authRoutes.post("/register", signInLimiter, asyncRoute(register));
authRoutes.post("/login", signInLimiter, asyncRoute(login));
authRoutes.post("/logout", asyncRoute(logout));
authRoutes.post("/email/verification/request", requireAuthentication, recoveryLimiter, asyncRoute(requestEmailVerification));
authRoutes.post("/email/verification/confirm", recoveryLimiter, asyncRoute(verifyEmail));
authRoutes.post("/password-reset/request", recoveryLimiter, asyncRoute(requestPasswordReset));
authRoutes.post("/password-reset/complete", recoveryLimiter, asyncRoute(resetPassword));
