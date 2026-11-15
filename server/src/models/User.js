import mongoose from "mongoose";

const laundryDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true, minlength: 3, maxlength: 20 },
  usernameNormalized: { type: String, required: true, select: false },
  passwordHash: { type: String, required: true, select: false },
  laundryDays: { type: [String], enum: laundryDays, default: ["Monday", "Thursday"] },
  categories: { type: [String], default: [] },
}, { timestamps: true });

userSchema.index({ usernameNormalized: 1 }, { unique: true });

export const User = mongoose.model("User", userSchema);
export { laundryDays };
