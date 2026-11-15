import bcrypt from "bcryptjs";
import path from "node:path";
import { rm } from "node:fs/promises";
import { User } from "../models/User.js";
import { ClothingItem } from "../models/ClothingItem.js";
import { LaundryEvent } from "../models/LaundryEvent.js";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";
import { userView } from "../services/userView.js";
import { currentPasswordSchema, passwordChangeSchema, scheduleSchema } from "../validation/schemas.js";

export async function updateSchedule(req, res) {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Choose valid laundry days.", "INVALID_SCHEDULE");
  const laundryDaysSelected = [...new Set(parsed.data.laundryDays)];
  const user = await User.findByIdAndUpdate(
    req.session.userId,
    { $set: { laundryDays: laundryDaysSelected } },
    { new: true, runValidators: true },
  );
  if (!user) throw new HttpError(404, "Account not found.", "USER_NOT_FOUND");
  res.json({ user: userView(user) });
}

export async function changePassword(req, res) {
  const parsed = passwordChangeSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues.map((issue) => issue.message).join(" "), "INVALID_PASSWORD");
  const user = await User.findById(req.session.userId).select("+passwordHash");
  if (!user) throw new HttpError(404, "Account not found.", "USER_NOT_FOUND");
  if (!await bcrypt.compare(parsed.data.currentPassword, user.passwordHash)) {
    throw new HttpError(400, "Current password is incorrect.", "INVALID_CURRENT_PASSWORD");
  }
  user.passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await user.save();
  res.json({ message: "Password updated." });
}

export async function exportAccount(req, res) {
  const user = await User.findById(req.session.userId).select("username laundryDays categories createdAt").lean();
  if (!user) throw new HttpError(404, "Account not found.", "USER_NOT_FOUND");
  const [items, events] = await Promise.all([
    ClothingItem.find({ owner: user._id }).select("name category status lostAt lastWashedAt archivedAt createdAt updatedAt").lean(),
    LaundryEvent.find({ owner: user._id }).select("item sentAt returnedAt status createdAt updatedAt").lean(),
  ]);
  res.setHeader("Content-Disposition", "attachment; filename=washday-account-export.json");
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ exportedAt: new Date().toISOString(), account: user, items, laundryEvents: events });
}

export async function deleteAccount(req, res) {
  const parsed = currentPasswordSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Enter your current password to delete your account.", "INVALID_PASSWORD");
  const user = await User.findById(req.session.userId).select("+passwordHash");
  if (!user) throw new HttpError(404, "Account not found.", "USER_NOT_FOUND");
  if (!await bcrypt.compare(parsed.data.currentPassword, user.passwordHash)) {
    throw new HttpError(400, "Current password is incorrect.", "INVALID_CURRENT_PASSWORD");
  }
  const items = await ClothingItem.find({ owner: user._id }).select("photoKey").lean();
  const photoKeys = items.map((item) => item.photoKey).filter((key) => typeof key === "string" && path.basename(key) === key);
  const sessionId = req.sessionID;
  const mongoSession = await User.db.startSession();
  try {
    await mongoSession.withTransaction(async () => {
      await LaundryEvent.deleteMany({ owner: user._id }, { session: mongoSession });
      await ClothingItem.deleteMany({ owner: user._id }, { session: mongoSession });
      await User.deleteOne({ _id: user._id }, { session: mongoSession });
    });
  } finally {
    await mongoSession.endSession();
  }
  await Promise.all(photoKeys.map((key) => rm(path.join(env.UPLOAD_DIR, key), { force: true })));
  await new Promise((resolve, reject) => req.sessionStore.destroy(sessionId, (error) => error ? reject(error) : resolve()));
  res.clearCookie("laundry.sid", { httpOnly: true, sameSite: "lax", secure: env.isProduction });
  res.status(204).end();
}
