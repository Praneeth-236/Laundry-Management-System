import { Router } from "express";
import { changePassword, deleteAccount, exportAccount, updateSchedule } from "../controllers/profileController.js";
import { asyncRoute } from "../middleware/asyncRoute.js";
import { requireAuthentication } from "../middleware/authentication.js";

export const profileRoutes = Router();
profileRoutes.use(requireAuthentication);
profileRoutes.patch("/schedule", asyncRoute(updateSchedule));
profileRoutes.patch("/password", asyncRoute(changePassword));
profileRoutes.get("/export", asyncRoute(exportAccount));
profileRoutes.delete("/account", asyncRoute(deleteAccount));
