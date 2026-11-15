import mongoose from "mongoose";

const laundryEventSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  item: { type: mongoose.Schema.Types.ObjectId, ref: "ClothingItem", required: true, index: true },
  sentAt: { type: Date, required: true, default: Date.now },
  returnedAt: { type: Date, default: null },
  status: { type: String, enum: ["pending", "returned", "missing"], required: true, default: "pending" },
}, { timestamps: true });

// The partial unique index is a database-level guard against two active cycles for one item.
laundryEventSchema.index(
  { item: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);
laundryEventSchema.index({ owner: 1, sentAt: -1 });

export const LaundryEvent = mongoose.model("LaundryEvent", laundryEventSchema);
