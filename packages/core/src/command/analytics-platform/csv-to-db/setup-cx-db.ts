import { DbCreds } from "@metriport/shared";
import { Client } from "pg";
import { capture, out } from "../../../util";
import {
  getCreateCxDbCommand,
  getCreateDbUserCommand,
  getCxDbExistsCommand,
  getCxDbName,
  getGrantAccessToDbUserCommand,
} from "./db-asset-defs";

/**
 * Streams patient CSV files from S3 and inserts them into PostgreSQL database.
 * Each CSV file represents a FHIR resource type (e.g., Patient, Condition, Encounter).
 *
 * @param param.cxId - Customer ID
 * @param param.region - AWS region
 * @param param.dbCreds - Database credentials
 */
export async function setupCustomerAnalyticsDb({
  cxId,
  dbCreds,
  lambdaUsers,
}: {
  cxId: string;
  dbCreds: DbCreds;
  lambdaUsers: { username: string; password: string }[];
}): Promise<void> {
  const { log } = out(`setupCustomerAnalyticsDb - cx ${cxId}`);

  const cxDbName = getCxDbName(cxId, dbCreds.dbname);

  capture.setExtra({ cxId, cxDbName });
  log(
    `Running with params: ${JSON.stringify({
      host: dbCreds.host,
      port: dbCreds.port,
      dbname: dbCreds.dbname,
      cxDbName,
      username: dbCreds.username,
    })}`
  );

  let dbClient = new Client({
    host: dbCreds.host,
    port: dbCreds.port,
    // connect to the main analytics db
    database: dbCreds.dbname,
    user: dbCreds.username,
    password: dbCreds.password,
  });
  try {
    const cxDbName = getCxDbName(cxId, dbCreds.dbname);
    await dbClient.connect();
    log(`Connected to database`);
    await createCustomerAnalyticsDb({ dbClient, cxDbName, log });
    await dbClient.end();
    log(`Disconnected from main database, connecting again to the cx db...`);

    dbClient = new Client({
      host: dbCreds.host,
      port: dbCreds.port,
      database: cxDbName,
      user: dbCreds.username,
      password: dbCreds.password,
    });
    await dbClient.connect();
    await createLambdasUsersInAnalyticsDb({
      dbClient,
      dbName: cxDbName,
      lambdaUsers,
    });
    log(`Successfully created analytics database and lambdas users`);
  } finally {
    await dbClient.end();
    log(`Disconnected from database`);
  }
}

async function createCustomerAnalyticsDb({
  dbClient,
  cxDbName,
  log,
}: {
  dbClient: Client;
  cxDbName: string;
  log: typeof console.log;
}): Promise<void> {
  const cmdExists = getCxDbExistsCommand({ cxDbName });
  const exists = await dbClient.query(cmdExists);
  if (exists.rowCount > 0) {
    log(`Database ${cxDbName} already exists, continuing...`);
    return;
  }
  const cmdCreate = getCreateCxDbCommand({ cxDbName });
  await dbClient.query(cmdCreate);
}

async function createLambdasUsersInAnalyticsDb({
  dbClient,
  dbName,
  lambdaUsers,
}: {
  dbClient: Client;
  dbName: string;
  lambdaUsers: { username: string; password: string }[];
}): Promise<void> {
  const promises = lambdaUsers.map(async ({ username, password }) => {
    const cmdCreate = getCreateDbUserCommand({ username, password });
    await dbClient.query(cmdCreate);

    const cmdGrant = getGrantAccessToDbUserCommand({ dbName, username });
    await dbClient.query(cmdGrant);
  });
  for (const promise of promises) await promise;
}
