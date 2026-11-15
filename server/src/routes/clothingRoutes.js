import { Router } from "express";
import multer from "multer";
import { asyncRoute } from "../middleware/asyncRoute.js";
import { requireAuthentication } from "../middleware/authentication.js";
import {
  addCategory, archiveClothing, createClothing, getPhoto,
  listClothing, markFound, markMissing,
} from "../controllers/clothingController.js";
import { HttpError } from "../utils/httpError.js";

export const clothingRoutes = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    if (!file.mimetype.startsWith("image/")) {
      return callback(new HttpError(400, "Upload an image file.", "INVALID_IMAGE"));
    }
    callback(null, true);
  },
});

clothingRoutes.use(requireAuthentication);
clothingRoutes.get("/", asyncRoute(listClothing));
clothingRoutes.post("/", upload.single("photo"), asyncRoute(createClothing));
clothingRoutes.post("/categories", asyncRoute(addCategory));
clothingRoutes.get("/:itemId/photo", asyncRoute(getPhoto));
clothingRoutes.post("/:itemId/missing", asyncRoute(markMissing));
clothingRoutes.post("/:itemId/found", asyncRoute(markFound));
clothingRoutes.delete("/:itemId", asyncRoute(archiveClothing));
