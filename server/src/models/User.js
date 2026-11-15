import mongoose from "mongoose";

const laundryDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true, minlength: 3, maxlength: 20 },
  usernameNormalized: { type: String, required: true, select: false },
  passwordHash: { type: String, required: true, select: false },
  email: { type: String, trim: true, lowercase: true },
  emailNormalized: { type: String, select: false },
  emailVerifiedAt: { type: Date, default: null },
  emailVerificationTokenHash: { type: String, select: false },
  emailVerificationExpiresAt: { type: Date, select: false },
  passwordResetTokenHash: { type: String, select: false },
  passwordResetExpiresAt: { type: Date, select: false },
  laundryDays: { type: [String], enum: laundryDays, default: ["Monday", "Thursday"] },
  categories: { type: [String], default: [] },
}, { timestamps: true });

userSchema.index({ usernameNormalized: 1 }, { unique: true });
userSchema.index({ emailNormalized: 1 }, {
  unique: true,
  partialFilterExpression: { emailNormalized: { $type: "string" } },
});

export const User = mongoose.model("User", userSchema);
export { laundryDays };
