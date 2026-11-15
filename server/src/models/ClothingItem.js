import mongoose from "mongoose";

const clothingItemSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  category: { type: String, required: true, trim: true, maxlength: 32 },
  status: { type: String, enum: ["available", "in_laundry", "missing"], default: "available", index: true },
  photoKey: { type: String, default: null },
  lostAt: { type: Date, default: null },
  lastWashedAt: { type: Date, default: null },
  archivedAt: { type: Date, default: null },
}, { timestamps: true });

// Collation makes uniqueness case-insensitive without changing how a name is displayed.
clothingItemSchema.index(
  { owner: 1, name: 1, category: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);
clothingItemSchema.index({ owner: 1, archivedAt: 1, category: 1, name: 1 });

export const ClothingItem = mongoose.model("ClothingItem", clothingItemSchema);
