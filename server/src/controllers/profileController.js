import bcrypt from "bcryptjs";
import path from "node:path";
import { env } from "../config/env.js";
import { photoStorage } from "../services/photoStorage.js";
import { emailService } from "../services/email.js";
import { hashRecoveryToken, issueRecoveryToken } from "../services/recoveryTokens.js";
import { User } from "../models/User.js";
import { ClothingItem } from "../models/ClothingItem.js";
import { LaundryEvent } from "../models/LaundryEvent.js";
import { HttpError } from "../utils/httpError.js";
import { userView } from "../services/userView.js";
import { currentPasswordSchema, passwordChangeSchema, recoveryEmailUpdateSchema, scheduleSchema } from "../validation/schemas.js";

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

export async function updateRecoveryEmail(req, res) {
  const parsed = recoveryEmailUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Enter a valid email and your current password.", "INVALID_EMAIL");
  const user = await User.findById(req.session.userId).select("+passwordHash");
  if (!user) throw new HttpError(404, "Account not found.", "USER_NOT_FOUND");
  if (!await bcrypt.compare(parsed.data.currentPassword, user.passwordHash)) {
    throw new HttpError(400, "Current password is incorrect.", "INVALID_CURRENT_PASSWORD");
  }
  if (user.email?.toLowerCase() === parsed.data.email && user.emailVerifiedAt) {
    return res.json({ message: "That recovery email is already verified.", user: userView(user) });
  }

  const verification = issueRecoveryToken();
  user.email = parsed.data.email;
  user.emailNormalized = parsed.data.email;
  user.emailVerifiedAt = null;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  if (emailService.enabled) {
    user.emailVerificationTokenHash = verification.hash;
    user.emailVerificationExpiresAt = verification.expiresAt;
  } else {
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpiresAt = undefined;
  }
  try { await user.save(); }
  catch (error) {
    if (error?.code === 11000) throw new HttpError(409, "That email address is already linked to another account.", "EMAIL_IN_USE");
    throw error;
  }

  if (!emailService.enabled) {
    return res.json({ message: "Email saved. Email delivery is not configured, so it cannot be verified yet.", user: userView(user) });
  }
  try { await emailService.sendVerification({ email: user.email, username: user.username, token: verification.token }); }
  catch (error) {
    await User.updateOne(
      { _id: user._id, emailVerificationTokenHash: hashRecoveryToken(verification.token) },
      { $unset: { emailVerificationTokenHash: 1, emailVerificationExpiresAt: 1 } },
    );
    console.error("Could not send an email verification message after an address change.", error);
    return res.json({ message: "Email saved, but the verification message could not be sent. Try again from this page.", user: userView(user) });
  }
  res.json({ message: "Recovery email saved. Verification link sent; it expires in 30 minutes.", user: userView(user) });
}

export async function exportAccount(req, res) {
  const user = await User.findById(req.session.userId).select("username email emailVerifiedAt laundryDays categories createdAt").lean();
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
      await User.db.collection("sessions").deleteMany({
        session: { $regex: `\"userId\":\"${user._id.toString()}\"` },
      }, { session: mongoSession });
      await User.deleteOne({ _id: user._id }, { session: mongoSession });
    });
  } finally {
    await mongoSession.endSession();
  }
  const cleanupResults = await Promise.allSettled(photoKeys.map((key) => photoStorage.delete(key)));
  for (const result of cleanupResults) {
    if (result.status === "rejected") console.error("Could not remove a deleted account photo.", result.reason);
  }
  await new Promise((resolve, reject) => req.sessionStore.destroy(sessionId, (error) => error ? reject(error) : resolve()));
  res.clearCookie("laundry.sid", { httpOnly: true, sameSite: "lax", secure: env.isProduction });
  res.status(204).end();
}
