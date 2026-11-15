import mongoose from "mongoose";

// Both the item status and its history event must change together. MongoDB
// transactions make that all-or-nothing guarantee across the two collections.
export async function withTransaction(work) {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => work(session));
  } finally {
    await session.endSession();
  }
}
