import { getEnvVarOrFail } from "@metriport/shared";
import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import { S3Utils } from "./s3";
import { seedCodeSystems } from "./seed/seedCodeSystem";
import { createTermServerClient, DbClient } from "./sqlClient";
import { tables } from "./tables";

const region = getEnvVarOrFail("AWS_REGION");

let dbClient: DbClient | undefined;

async function initTables(dbClient: DbClient): Promise<void> {
  for (const table of tables) {
    await dbClient.run(table);
  }
}

export async function initTermServer(): Promise<void> {
  const key = "terminology_v2.db";

  const dbPath = join(process.cwd(), key);

  if (!existsSync(dbPath)) {
    const s3Utils = new S3Utils(region);
    const bucket = getEnvVarOrFail("TERMINOLOGY_BUCKET");
    console.log(`Downloading file from S3: ${bucket}/${key}`);
    const db = await s3Utils.downloadFile({ bucket, key });
    console.log(`Downloaded file size: ${db.length} bytes`);
    writeFileSync(dbPath, db);
  } else {
    console.log(`Database file already exists at ${dbPath}`);
  }

  dbClient = createTermServerClient(dbPath);
  await initTables(dbClient);
  await seedCodeSystems(dbClient);
}

export function getTermServerClient(): DbClient {
  if (!dbClient) {
    throw new Error("Database client is not initialized. Call initTermServer first.");
  }
  return dbClient;
}
