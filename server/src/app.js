import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import helmet from "helmet";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { env } from "./config/env.js";
import { health } from "./controllers/healthController.js";
import { dashboardStats } from "./controllers/clothingController.js";
import { requireAuthentication } from "./middleware/authentication.js";
import { asyncRoute } from "./middleware/asyncRoute.js";
import { protectAgainstCsrf } from "./middleware/csrf.js";
import { requestContext } from "./middleware/requestContext.js";
import { authRoutes } from "./routes/authRoutes.js";
import { clothingRoutes } from "./routes/clothingRoutes.js";
import { laundryRoutes } from "./routes/laundryRoutes.js";
import { profileRoutes } from "./routes/profileRoutes.js";
import { HttpError } from "./utils/httpError.js";

export function createApp() {
  const app = express();
  if (env.isProduction) app.set("trust proxy", 1);

  app.use(requestContext);
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "100kb" }));
  const sessionStore = MongoStore.create({
    mongoUrl: env.MONGODB_URI,
    collectionName: "sessions",
    ttl: 7 * 24 * 60 * 60,
  });
  app.locals.sessionStore = sessionStore;
  app.use(session({
    name: "laundry.sid",
    secret: env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: env.isProduction,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }));

  // The synchronizer token is checked before any state-changing API route.
  app.use("/api", protectAgainstCsrf);
  app.get("/api/health", health);
  app.use("/api/auth", authRoutes);
  app.use("/api/clothes", clothingRoutes);
  app.use("/api/laundry", laundryRoutes);
  app.use("/api/profile", profileRoutes);
  app.get("/api/dashboard/stats", requireAuthentication, asyncRoute(dashboardStats));
  app.use("/api", (_req, _res, next) => next(new HttpError(404, "API route not found.", "NOT_FOUND")));

  if (existsSync(env.clientDist)) {
    app.use(express.static(env.clientDist, { index: false, maxAge: env.isProduction ? "1h" : 0 }));
    app.get(/.*/, (_req, res) => res.sendFile(join(env.clientDist, "index.html")));
  }

  app.use((error, _req, res, _next) => {
    if (error?.name === "MulterError") {
      const tooLarge = error.code === "LIMIT_FILE_SIZE";
      return res.status(tooLarge ? 413 : 400).json({
        error: {
          code: tooLarge ? "FILE_TOO_LARGE" : "INVALID_UPLOAD",
          message: tooLarge ? "Images must be 5 MB or smaller." : "The upload contains too many or invalid fields.",
        },
      });
    }
    if (error?.name === "ValidationError" || error?.name === "CastError") {
      return res.status(400).json({ error: { code: "INVALID_INPUT", message: "The submitted data is invalid." } });
    }
    if (error?.name === "ZodError") {
      return res.status(400).json({ error: { code: "INVALID_INPUT", message: "The submitted data is invalid." } });
    }
    if (error?.code === 11000) {
      return res.status(409).json({ error: { code: "DUPLICATE_RECORD", message: "That record already exists." } });
    }

    const status = Number.isInteger(error?.status) ? error.status : 500;
    if (status >= 500) {
      console.error(JSON.stringify({
        level: "error",
        event: "request_failed",
        requestId: _req.requestId,
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
      }));
    }
    const message = status >= 500 ? "Something went wrong. Try again." : error.message;
    res.status(status).json({ error: { code: error?.code ?? "INTERNAL_ERROR", message, requestId: _req.requestId } });
  });

  return app;
}

export const app = createApp();
