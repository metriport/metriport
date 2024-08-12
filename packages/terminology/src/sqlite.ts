import { join } from "path";
import { writeFileSync, existsSync } from "fs";

import { S3Utils } from "./s3";

import { SqliteClient } from "./sqlClient";
import * as migrations from "./migrations/index";
import { seedCodeSystems } from "./seed/seedCodeSystem";
import { Config } from "./config";

const region = Config.getAWSRegion();

let dbClient: SqliteClient | undefined;

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
  const key = "terminology.db";

  const dbPath = join(process.cwd(), key);

  if (!existsSync(dbPath)) {
    const s3Utils = new S3Utils(region);
    const bucket = Config.getTerminologyBucket();
    console.log(`Downloading file from S3: ${bucket}/${key}`);
    const db = await s3Utils.downloadFile({ bucket, key });
    console.log(`Downloaded file size: ${db.length} bytes`);
    writeFileSync(dbPath, db);
  } else {
    console.log(`Database file already exists at ${dbPath}`);
  }

  dbClient = new SqliteClient(dbPath);
  await migrate(dbClient);
  await seedCodeSystems(dbClient);
}

export function getSqliteClient(): SqliteClient {
  if (!dbClient) {
    throw new Error("Database client is not initialized. Call initSqliteFhirServer first.");
  }
  return dbClient;
}
