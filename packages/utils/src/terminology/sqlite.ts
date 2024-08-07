import { join } from "path";
import { mkdirSync } from "fs";

import { SqliteClient } from "./sqlClient";
import * as migrations from "./migrations/index";

let dbClient: SqliteClient;

type Migration = {
  sql: string;
};

async function migrate(dbClient: SqliteClient): Promise<void> {
  await dbClient.run(`CREATE TABLE IF NOT EXISTS "DatabaseMigration" (
        "id" INTEGER NOT NULL PRIMARY KEY,
        "version" INTEGER NOT NULL,
        "dataVersion" INTEGER NOT NULL
  )`);

  const result = await dbClient.select('SELECT "version" FROM "DatabaseMigration"');
  const version = result[0]?.version ?? -1;

  if (version < 0) {
    await dbClient.run(
      'INSERT INTO "DatabaseMigration" ("id", "version", "dataVersion") VALUES (1, 0, 0)'
    );
  }

  const migrationKeys = Object.keys(migrations);
  for (let i = version + 1; i <= migrationKeys.length; i++) {
    const migration = (migrations as Record<string, Migration>)["v" + i];
    if (migration) {
      console.log("Running migration", migration.sql);
      await dbClient.run(migration.sql);
      await dbClient.run(`UPDATE "DatabaseMigration" SET "version"=${i}`);
    }
  }
}

// Function to initialize SQLite
export async function initSqliteFhirServer(): Promise<void> {
  const dbDir = join(process.cwd(), "src/terminology/data");
  const dbPath = join(dbDir, "terminology.db");

  // Ensure the directory exists
  try {
    mkdirSync(dbDir, { recursive: true });
  } catch (err) {
    console.error("Error creating database directory:", err);
    throw err;
  }

  const dbClient = new SqliteClient(dbPath);
  await migrate(dbClient);
}

export { dbClient };
