import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runMigrations } from "../src/utils/migrations.js";

function createDatabase(initial = []) {
  const records = [...initial];
  return {
    records,
    collection(name) {
      assert.equal(name, "schema_migrations");
      return {
        find: () => ({ toArray: async () => [...records] }),
        insertOne: async (record) => { records.push(record); },
      };
    },
  };
}

test("database migrations run in order and are skipped after being recorded", async () => {
  const database = createDatabase();
  const executed = [];
  const migrations = [
    { id: "001_baseline-indexes", up: async () => executed.push("001") },
    { id: "002_add-feature-field", up: async () => executed.push("002") },
  ];

  assert.equal(await runMigrations(database, migrations), 2);
  assert.deepEqual(executed, ["001", "002"]);
  assert.equal(await runMigrations(database, migrations), 0);
  assert.deepEqual(executed, ["001", "002"]);
});

test("failed migrations are not marked as applied and can be retried", async () => {
  const database = createDatabase();
  const migration = { id: "001_add-index", up: async () => { throw new Error("temporary failure"); } };

  await assert.rejects(runMigrations(database, [migration]), /temporary failure/);
  assert.deepEqual(database.records, []);
});

test("migration history must be complete and ordered", async () => {
  const database = createDatabase([{ _id: "002_removed-migration" }]);
  await assert.rejects(runMigrations(database, [{ id: "001_baseline-indexes", up: async () => {} }]), /missing from this release/);
  await assert.rejects(runMigrations(createDatabase(), [
    { id: "002_second", up: async () => {} },
    { id: "001_first", up: async () => {} },
  ]), /ascending order/);
});

test("production migration command requires an explicit confirmation flag", () => {
  assert.throws(() => execFileSync(process.execPath, ["scripts/migrate-database.js"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: {
      ...process.env,
      NODE_ENV: "production",
      DEPLOYMENT_MODE: "demo",
      PUBLIC_APP_URL: "https://washday.example",
      SESSION_SECRET: "migration-test-session-secret-0123456789",
      MONGODB_URI: "mongodb://127.0.0.1:27017/washday?replicaSet=rs0",
    },
    encoding: "utf8",
    stdio: "pipe",
  }), (error) => {
    assert.equal(error.status, 1);
    assert.match(error.stderr.toString(), /--confirm-production/);
    return true;
  });
});
