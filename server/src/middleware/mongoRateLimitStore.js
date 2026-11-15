import mongoose from "mongoose";

function unwrapDocument(result) {
  return result?.value ?? result;
}

/** MongoDB-backed fixed-window store shared by every API instance. */
export class MongoRateLimitStore {
  constructor({ prefix = "washday:auth:", collectionName = "rate_limits" } = {}) {
    this.prefix = prefix;
    this.collectionName = collectionName;
    this.localKeys = false;
  }

  get collection() {
    const database = mongoose.connection.db;
    if (!database) throw new Error("MongoDB must be connected before using the rate-limit store.");
    return database.collection(this.collectionName);
  }

  async init(options) {
    if (!Number.isFinite(options.windowMs) || options.windowMs <= 0) {
      throw new TypeError("The rate-limit window must be a positive number of milliseconds.");
    }
    this.windowMs = options.windowMs;
  }

  async increment(key) {
    if (!this.windowMs) throw new Error("The MongoDB rate-limit store has not been initialized.");
    const id = `${this.prefix}${key}`;

    // A bounded retry handles TTL cleanup racing an insert and requests that
    // initialize the same client's counter at the same time on different hosts.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const now = new Date();
      const active = unwrapDocument(await this.collection.findOneAndUpdate(
        { _id: id, resetAt: { $gt: now } },
        { $inc: { totalHits: 1 } },
        { returnDocument: "after", includeResultMetadata: false },
      ));
      if (active) return { totalHits: active.totalHits, resetTime: active.resetAt };

      const resetAt = new Date(now.getTime() + this.windowMs);
      try {
        await this.collection.insertOne({ _id: id, storePrefix: this.prefix, totalHits: 1, resetAt });
        return { totalHits: 1, resetTime: resetAt };
      } catch (error) {
        if (error?.code !== 11000) throw error;
      }

      const expired = unwrapDocument(await this.collection.findOneAndUpdate(
        { _id: id, resetAt: { $lte: now } },
        { $set: { storePrefix: this.prefix, totalHits: 1, resetAt } },
        { returnDocument: "after", includeResultMetadata: false },
      ));
      if (expired) return { totalHits: 1, resetTime: expired.resetAt };
    }

    throw new Error("Could not initialize the MongoDB rate-limit counter after concurrent updates.");
  }

  async decrement(key) {
    const now = new Date();
    await this.collection.updateOne(
      { _id: `${this.prefix}${key}`, resetAt: { $gt: now }, totalHits: { $gt: 0 } },
      { $inc: { totalHits: -1 } },
    );
  }

  async get(key) {
    const record = await this.collection.findOne({
      _id: `${this.prefix}${key}`,
      resetAt: { $gt: new Date() },
    });
    return record ? { totalHits: record.totalHits, resetTime: record.resetAt } : undefined;
  }

  async resetKey(key) {
    await this.collection.deleteOne({ _id: `${this.prefix}${key}` });
  }

  async resetAll() {
    await this.collection.deleteMany({ storePrefix: this.prefix });
  }
}
