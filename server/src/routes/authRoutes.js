import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { asyncRoute } from "../middleware/asyncRoute.js";
import { issueCsrfToken } from "../middleware/csrf.js";
import { currentUser, login, logout, register } from "../controllers/authController.js";

export const authRoutes = Router();

const signInLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "TOO_MANY_ATTEMPTS", message: "Too many sign-in attempts. Try again later." } },
});

authRoutes.get("/csrf", issueCsrfToken);
authRoutes.get("/me", asyncRoute(currentUser));
authRoutes.post("/register", signInLimiter, asyncRoute(register));
authRoutes.post("/login", signInLimiter, asyncRoute(login));
authRoutes.post("/logout", asyncRoute(logout));
