import { DbCredsWithSchema } from "@metriport/shared";
import { Client } from "pg";
import { capture, out } from "../../../util";
import {
  getCreateCxDbCommand,
  getCreateDbUserIfNotExistsCommand,
  getCreateSchemaCommand,
  getCxDbExistsCommand,
  getCxDbName,
  getGrantAccessToDbUserCommand,
  getSchemaExistsCommand,
  rawDbSchema,
} from "./db-asset-defs";

/**
 * Creates the customer analytics database in the main analytics DB instance, and set it up
 * for usage.
 *
 * It also creates the additional users if provided. Those are typically dedicated users with
 * limited access, used for specific purposes, like lambda functions.
 *
 * @param param.cxId - Customer ID
 * @param param.dbCreds - Database credentials
 * @param param.lambdaUsers - Additional users to create
 */
export async function setupCustomerAnalyticsDb({
  cxId,
  dbCreds,
  lambdaUsers,
}: {
  cxId: string;
  dbCreds: DbCredsWithSchema;
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

  const dbClient = new Client({
    host: dbCreds.host,
    port: dbCreds.port,
    database: dbCreds.dbname,
    user: dbCreds.username,
    password: dbCreds.password,
  });
  try {
    const cxDbName = getCxDbName(cxId, dbCreds.dbname);
    await dbClient.connect();
    log(`Connected to database`);

    await initializeDbInstanceIfNeeded({ dbClient, log });

    await createCustomerAnalyticsDb({ dbClient, cxDbName, log });

    await createLambdasUsersInAnalyticsDb({
      dbClient,
      dbName: cxDbName,
      schemaName: dbCreds.schemaName,
      lambdaUsers,
    });
    log(`Successfully created analytics database and lambdas users`);
  } finally {
    await dbClient.end();
    log(`Disconnected from database`);
  }
}

async function initializeDbInstanceIfNeeded({
  dbClient,
  log,
}: {
  dbClient: Client;
  log: typeof console.log;
}): Promise<void> {
  const cmdExists = `SELECT extname, extversion FROM pg_extension WHERE extname = 'aws_s3'`;
  const exists = await dbClient.query(cmdExists);
  if (exists.rowCount > 0) return;
  const cmdCreate = `CREATE EXTENSION aws_s3 CASCADE`;
  await dbClient.query(cmdCreate);
  log(`Created aws_s3 extension`);
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
  const cmdDbExists = getCxDbExistsCommand({ cxDbName });
  const dbExists = await dbClient.query(cmdDbExists);
  if (dbExists.rowCount < 1) {
    const cmdCreate = getCreateCxDbCommand({ cxDbName });
    await dbClient.query(cmdCreate);
    log(`Database ${cxDbName} created`);
  } else {
    log(`Database ${cxDbName} already exists`);
  }

  const cmdSchemaExists = getSchemaExistsCommand({ schemaName: rawDbSchema });
  const schemaExists = await dbClient.query(cmdSchemaExists);
  if (schemaExists.rowCount < 1) {
    const cmdCreate = getCreateSchemaCommand({ schemaName: rawDbSchema });
    await dbClient.query(cmdCreate);
    log(`Schema ${rawDbSchema} created`);
  } else {
    log(`Schema ${rawDbSchema} already exists`);
  }
}

async function createLambdasUsersInAnalyticsDb({
  dbClient,
  dbName,
  schemaName,
  lambdaUsers,
}: {
  dbClient: Client;
  dbName: string;
  schemaName: string;
  lambdaUsers: { username: string; password: string }[];
}): Promise<void> {
  const promises = lambdaUsers.map(async ({ username, password }) => {
    const cmdCreate = getCreateDbUserIfNotExistsCommand({ username, password });
    await dbClient.query(cmdCreate);

    const cmdGrant = getGrantAccessToDbUserCommand({ dbName, schemaName, username });
    await dbClient.query(cmdGrant);
  });
  for (const promise of promises) await promise;
}
