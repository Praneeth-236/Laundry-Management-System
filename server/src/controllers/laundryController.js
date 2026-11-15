import { Types } from "mongoose";
import { ClothingItem } from "../models/ClothingItem.js";
import { LaundryEvent } from "../models/LaundryEvent.js";
import { User } from "../models/User.js";
import { HttpError } from "../utils/httpError.js";
import { withTransaction } from "../utils/transactions.js";
import { objectIdSchema, sendLaundrySchema } from "../validation/schemas.js";

export async function getLaundryOverview(req, res) {
  const [user, availableItems, history] = await Promise.all([
    User.findById(req.session.userId).select("laundryDays").lean(),
    ClothingItem.find({ owner: req.session.userId, status: "available", archivedAt: null })
      .sort({ category: 1, name: 1 }).lean(),
    LaundryEvent.find({ owner: req.session.userId })
      .sort({ sentAt: -1 }).limit(100).populate("item", "name category").lean(),
  ]);
  const currentDay = new Intl.DateTimeFormat("en", { weekday: "long" }).format(new Date());
  res.json({
    laundryDays: user?.laundryDays ?? [],
    currentDay,
    canSubmit: Boolean(user?.laundryDays.includes(currentDay)),
    availableItems,
    history: history.filter((event) => event.item),
  });
}

export async function sendToLaundry(req, res) {
  const parsed = sendLaundrySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues.map((issue) => issue.message).join(" "), "INVALID_INPUT");
  }
  const itemIds = parsed.data.itemIds.map((id) => new Types.ObjectId(id));
  const user = await User.findById(req.session.userId).select("laundryDays").lean();
  const currentDay = new Intl.DateTimeFormat("en", { weekday: "long" }).format(new Date());
  if (!user?.laundryDays.includes(currentDay)) {
    throw new HttpError(409, `Your laundry schedule does not allow submissions today (${currentDay}).`, "SCHEDULE_CLOSED");
  }

  const sentAt = new Date();
  await withTransaction(async (session) => {
    const available = await ClothingItem.find({
      _id: { $in: itemIds }, owner: req.session.userId, status: "available", archivedAt: null,
    }).select("_id").session(session).lean();
    if (available.length !== itemIds.length) {
      throw new HttpError(409, "One or more selected items are no longer available.", "ITEMS_CHANGED");
    }

    await LaundryEvent.insertMany(itemIds.map((itemId) => ({
      owner: req.session.userId,
      item: itemId,
      sentAt,
      status: "pending",
    })), { session, ordered: true });

    const updated = await ClothingItem.updateMany(
      { _id: { $in: itemIds }, owner: req.session.userId, status: "available", archivedAt: null },
      { $set: { status: "in_laundry" } },
      { session },
    );
    if (updated.modifiedCount !== itemIds.length) {
      throw new HttpError(409, "The selected items changed while this request was being saved.", "ITEMS_CHANGED");
    }
  });

  res.status(201).json({ message: `${itemIds.length} item(s) added to this laundry cycle.` });
}

async function finishEvent(req, res, resultStatus) {
  const eventId = objectIdSchema.safeParse(req.params.eventId);
  if (!eventId.success) throw new HttpError(400, "Invalid laundry record.", "INVALID_ID");
  const returnedAt = resultStatus === "returned" ? new Date() : null;
  const lostAt = resultStatus === "missing" ? new Date() : null;

  await withTransaction(async (session) => {
    const event = await LaundryEvent.findOne({
      _id: eventId.data, owner: req.session.userId, status: "pending",
    }).session(session);
    if (!event) throw new HttpError(404, "That laundry record is not pending.", "EVENT_NOT_FOUND");

    const itemStatus = resultStatus === "returned" ? "available" : "missing";
    const item = await ClothingItem.findOneAndUpdate(
      { _id: event.item, owner: req.session.userId, status: "in_laundry", archivedAt: null },
      { $set: {
        status: itemStatus,
        lastWashedAt: returnedAt,
        lostAt,
      } },
      { new: true, session },
    );
    if (!item) throw new HttpError(409, "The clothing item is no longer in this laundry cycle.", "INVALID_ITEM_STATE");

    event.status = resultStatus;
    event.returnedAt = returnedAt;
    await event.save({ session });
  });

  res.json({ message: resultStatus === "returned" ? "Item marked as returned." : "Item marked missing." });
}

export async function markReturned(req, res) {
  await finishEvent(req, res, "returned");
}

export async function markMissingFromLaundry(req, res) {
  await finishEvent(req, res, "missing");
}
