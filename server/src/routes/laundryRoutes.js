import { Router } from "express";
import { getLaundryOverview, markMissingFromLaundry, markReturned, sendToLaundry } from "../controllers/laundryController.js";
import { asyncRoute } from "../middleware/asyncRoute.js";
import { requireAuthentication } from "../middleware/authentication.js";

export const laundryRoutes = Router();
laundryRoutes.use(requireAuthentication);
laundryRoutes.get("/", asyncRoute(getLaundryOverview));
laundryRoutes.post("/", asyncRoute(sendToLaundry));
laundryRoutes.post("/:eventId/return", asyncRoute(markReturned));
laundryRoutes.post("/:eventId/missing", asyncRoute(markMissingFromLaundry));
