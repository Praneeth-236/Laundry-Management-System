import mongoose from "mongoose";
import { connectDatabase, closeDatabase } from "../src/config/database.js";
import { env } from "../src/config/env.js";
import { baselineIndexesMigration } from "../src/migrations/001_baseline_indexes.js";
import { runMigrations } from "../src/utils/migrations.js";

if (env.NODE_ENV === "production" && !process.argv.includes("--confirm-production")) {
  console.error("Refusing to run migrations in production without --confirm-production.");
  process.exit(1);
}

try {
  await connectDatabase({ ensureIndexes: false });
  const count = await runMigrations(mongoose.connection.db, [baselineIndexesMigration]);
  console.info(count ? `Applied ${count} database migration.` : "Database is already up to date.");
} catch (error) {
  console.error("Database migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
