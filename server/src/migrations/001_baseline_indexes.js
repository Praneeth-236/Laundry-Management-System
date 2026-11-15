import { ensureDatabaseIndexes } from "../config/database.js";

// Record the indexes already maintained by the application. This idempotent
// baseline lets existing databases enter the versioned migration history.
export const baselineIndexesMigration = Object.freeze({
  id: "001_baseline-indexes",
  up: async () => ensureDatabaseIndexes(),
});
