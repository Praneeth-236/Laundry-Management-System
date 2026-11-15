import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Types } from "mongoose";
import { env } from "../config/env.js";
import { ClothingItem } from "../models/ClothingItem.js";
import { User } from "../models/User.js";
import { HttpError } from "../utils/httpError.js";
import { categorySchema, clothingItemSchema, objectIdSchema } from "../validation/schemas.js";

const builtInCategories = [
  "Shirt", "T-shirt", "Pants", "Jeans", "Kurta", "Pyjama", "Towels",
  "Bed Sheets", "Pillow Covers", "Shorts",
];
const allowedImageTypes = {
  ".png": { mime: "image/png", signature: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  ".jpg": { mime: "image/jpeg", signature: Buffer.from([0xff, 0xd8, 0xff]) },
  ".jpeg": { mime: "image/jpeg", signature: Buffer.from([0xff, 0xd8, 0xff]) },
  ".gif": { mime: "image/gif", signature: Buffer.from("GIF8") },
  ".webp": { mime: "image/webp", signature: Buffer.from("RIFF"), webp: true },
};

function parseBody(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HttpError(400, result.error.issues.map((issue) => issue.message).join(" "), "INVALID_INPUT");
  }
  return result.data;
}

function escapedRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function savePhoto(file, ownerId) {
  if (!file) return null;
  const extension = path.extname(file.originalname).toLowerCase();
  const imageType = allowedImageTypes[extension];
  if (!imageType || file.mimetype !== imageType.mime || !file.buffer.subarray(0, imageType.signature.length).equals(imageType.signature)) {
    throw new HttpError(400, "Choose a valid PNG, JPEG, GIF, or WebP image.", "INVALID_IMAGE");
  }
  if (imageType.webp && file.buffer.subarray(8, 12).toString("ascii") !== "WEBP") {
    throw new HttpError(400, "Choose a valid WebP image.", "INVALID_IMAGE");
  }
  const key = `${ownerId}-${randomUUID()}${extension}`;
  await mkdir(env.UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(env.UPLOAD_DIR, key), file.buffer, { flag: "wx" });
  return key;
}

export async function listClothing(req, res) {
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 80) : "";
  const category = typeof req.query.category === "string" ? req.query.category.trim().slice(0, 32) : "";
  const filter = { owner: req.session.userId, archivedAt: null };
  if (search) filter.name = { $regex: escapedRegex(search), $options: "i" };
  if (category) filter.category = category;
  const items = await ClothingItem.find(filter).sort({ category: 1, name: 1 }).lean();
  const user = await User.findById(req.session.userId).select("categories").lean();
  res.json({ items, categories: [...new Set([...builtInCategories, ...(user?.categories ?? [])])] });
}

export async function createClothing(req, res) {
  const { name, category } = parseBody(clothingItemSchema, req.body);
  const user = await User.findById(req.session.userId).select("categories");
  const categories = [...builtInCategories, ...(user?.categories ?? [])];
  if (!categories.some((entry) => entry.toLowerCase() === category.toLowerCase())) {
    throw new HttpError(400, "Choose an existing category or add it from your closet first.", "UNKNOWN_CATEGORY");
  }

  const photoKey = await savePhoto(req.file, req.session.userId);
  try {
    const item = await ClothingItem.create({ owner: req.session.userId, name, category, photoKey });
    res.status(201).json({ item });
  } catch (error) {
    if (photoKey) await rm(path.join(env.UPLOAD_DIR, photoKey), { force: true });
    if (error?.code === 11000) {
      throw new HttpError(409, "That item already exists in this category.", "DUPLICATE_ITEM");
    }
    throw error;
  }
}

export async function addCategory(req, res) {
  const { name } = parseBody(categorySchema, req.body);
  if (builtInCategories.some((category) => category.toLowerCase() === name.toLowerCase())) {
    throw new HttpError(409, "That category is already built in.", "DUPLICATE_CATEGORY");
  }
  const user = await User.findById(req.session.userId);
  if (!user) throw new HttpError(404, "Account not found.", "USER_NOT_FOUND");
  if (user.categories.some((category) => category.toLowerCase() === name.toLowerCase())) {
    throw new HttpError(409, "That category already exists.", "DUPLICATE_CATEGORY");
  }
  if (user.categories.length >= 30) {
    throw new HttpError(409, "You can add up to 30 custom categories.", "CATEGORY_LIMIT_REACHED");
  }
  user.categories.push(name);
  await user.save();
  res.status(201).json({ categories: [...builtInCategories, ...user.categories] });
}

export async function archiveClothing(req, res) {
  const id = objectIdSchema.parse(req.params.itemId);
  const archivedAt = new Date();
  const item = await ClothingItem.findOneAndUpdate(
    { _id: id, owner: req.session.userId, archivedAt: null, status: { $ne: "in_laundry" } },
    { $set: { archivedAt, photoKey: null } },
    { new: false },
  );
  if (!item) throw new HttpError(404, "Item not found or still in laundry.", "ITEM_NOT_AVAILABLE");
  const photoKey = item.photoKey;
  item.archivedAt = archivedAt;
  item.photoKey = null;
  if (photoKey && path.basename(photoKey) === photoKey) {
    try { await rm(path.join(env.UPLOAD_DIR, photoKey), { force: true }); }
    catch (error) { console.error("Could not remove archived clothing photo.", error); }
  }
  res.json({ item });
}

export async function markMissing(req, res) {
  const id = objectIdSchema.parse(req.params.itemId);
  const item = await ClothingItem.findOneAndUpdate(
    { _id: id, owner: req.session.userId, archivedAt: null, status: "available" },
    { $set: { status: "missing", lostAt: new Date() } },
    { new: true },
  );
  if (!item) throw new HttpError(409, "Only available items can be marked missing.", "INVALID_ITEM_STATE");
  res.json({ item });
}

export async function markFound(req, res) {
  const id = objectIdSchema.parse(req.params.itemId);
  const item = await ClothingItem.findOneAndUpdate(
    { _id: id, owner: req.session.userId, archivedAt: null, status: "missing" },
    { $set: { status: "available", lostAt: null } },
    { new: true },
  );
  if (!item) throw new HttpError(404, "Missing item not found.", "ITEM_NOT_FOUND");
  res.json({ item });
}

export async function getPhoto(req, res) {
  const id = objectIdSchema.parse(req.params.itemId);
  const item = await ClothingItem.findOne({ _id: id, owner: req.session.userId }).select("photoKey").lean();
  if (!item?.photoKey) throw new HttpError(404, "Photo not found.", "PHOTO_NOT_FOUND");
  res.setHeader("Cache-Control", "private, no-store");
  res.sendFile(item.photoKey, { root: env.UPLOAD_DIR }, (error) => {
    if (error && !res.headersSent) res.status(error.statusCode ?? 404).end();
  });
}

export async function dashboardStats(req, res) {
  const grouped = await ClothingItem.aggregate([
    { $match: { owner: new Types.ObjectId(req.session.userId), archivedAt: null } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const stats = Object.fromEntries(grouped.map((entry) => [entry._id, entry.count]));
  res.json({
    stats: {
      total: Object.values(stats).reduce((sum, value) => sum + value, 0),
      available: stats.available ?? 0,
      inLaundry: stats.in_laundry ?? 0,
      missing: stats.missing ?? 0,
    },
  });
}
