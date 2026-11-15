import { Router } from "express";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import { asyncRoute } from "../middleware/asyncRoute.js";
import { requireAuthentication } from "../middleware/authentication.js";
import { MongoRateLimitStore } from "../middleware/mongoRateLimitStore.js";
import {
  addCategory, archiveClothing, createClothing, getPhoto,
  listClothing, markFound, markMissing,
} from "../controllers/clothingController.js";
import { HttpError } from "../utils/httpError.js";

export const clothingRoutes = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 2,
    parts: 3,
    fieldSize: 8 * 1024,
  },
  fileFilter(_req, file, callback) {
    if (!file.mimetype.startsWith("image/")) {
      return callback(new HttpError(400, "Upload an image file.", "INVALID_IMAGE"));
    }
    callback(null, true);
  },
});
const photoUploadLimiter = rateLimit({
  store: new MongoRateLimitStore({ prefix: "washday:photo-uploads:" }),
  windowMs: 24 * 60 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => req.session.userId,
  skip: (req) => !req.file,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "PHOTO_UPLOAD_LIMIT", message: "You have reached today's photo upload limit. Try again tomorrow." } },
});

clothingRoutes.use(requireAuthentication);
clothingRoutes.get("/", asyncRoute(listClothing));
clothingRoutes.post("/", upload.single("photo"), photoUploadLimiter, asyncRoute(createClothing));
clothingRoutes.post("/categories", asyncRoute(addCategory));
clothingRoutes.get("/:itemId/photo", asyncRoute(getPhoto));
clothingRoutes.post("/:itemId/missing", asyncRoute(markMissing));
clothingRoutes.post("/:itemId/found", asyncRoute(markFound));
clothingRoutes.delete("/:itemId", asyncRoute(archiveClothing));
