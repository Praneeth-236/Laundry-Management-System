import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { HttpError } from "../utils/httpError.js";
import { userView } from "../services/userView.js";
import { passwordChangeSchema, scheduleSchema } from "../validation/schemas.js";

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
  const parsed = passwordSchema.safeParse(req.body);
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
