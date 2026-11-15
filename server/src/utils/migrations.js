const migrationCollectionName = "schema_migrations";
const migrationIdPattern = /^\d{3,}_[a-z0-9-]+$/;

export async function runMigrations(database, migrations) {
  const seen = new Set();
  let previousId = "";
  for (const migration of migrations) {
    if (!migrationIdPattern.test(migration?.id ?? "") || typeof migration.up !== "function") {
      throw new TypeError("Each migration needs a numeric id and an up(database) function.");
    }
    if (seen.has(migration.id) || migration.id <= previousId) {
      throw new TypeError("Migrations must have unique ids in ascending order.");
    }
    seen.add(migration.id);
    previousId = migration.id;
  }

  const history = database.collection(migrationCollectionName);
  const records = await history.find({}, { projection: { _id: 1 } }).toArray();
  const applied = new Set(records.map(({ _id }) => _id));
  const unknown = [...applied].filter((id) => !seen.has(id));
  if (unknown.length) {
    throw new Error(`Database contains migrations missing from this release: ${unknown.join(", ")}.`);
  }

  let appliedCount = 0;
  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    await migration.up(database);
    await history.insertOne({ _id: migration.id, appliedAt: new Date() });
    appliedCount += 1;
  }
  return appliedCount;
}
