import mongoose from "mongoose";
import { env } from "./env.js";
import { User } from "../models/User.js";
import { ClothingItem } from "../models/ClothingItem.js";
import { LaundryEvent } from "../models/LaundryEvent.js";

export async function connectDatabase() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  // Build model indexes before accepting requests so uniqueness and active-cycle
  // constraints are enforced by MongoDB, not just by application code.
  await Promise.all([User.createIndexes(), ClothingItem.createIndexes(), LaundryEvent.createIndexes()]);
  await mongoose.connection.collection("rate_limits").createIndex(
    { resetAt: 1 },
    { expireAfterSeconds: 0, name: "rate_limit_expiry" },
  );
  console.info(`MongoDB connected: ${mongoose.connection.name}`);
}

export async function closeDatabase() {
  await mongoose.disconnect();
}
