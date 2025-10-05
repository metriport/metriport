import { DbCredsWithSchema } from "@metriport/shared";
import { Client } from "pg";
import { capture, out } from "../../../util";
import { Config } from "../../../util/config";
import {
  getCreateCxDbCommand,
  getCreateDbUserIfNotExistsCommand,
  getCreateSchemaCommand,
  getCxDbExistsCommand,
  getCxDbName,
  getGrantAccessToDbUserCommand,
  getGrantFullAccessToAllSchemasCommand,
  getSchemaExistsCommand,
  rawDbSchema,
} from "./db-asset-defs";

export type SingleUserAndPassword = { username: string; password: string };

export type UsersToCreateAndGrantAccess = {
  f2c: SingleUserAndPassword;
  r2c: SingleUserAndPassword;
};

/**
 * Creates the customer analytics database in the main analytics DB instance, and set it up
 * for usage.
 *
 * It also creates the additional users if provided. Those are typically dedicated users with
 * limited access, used for specific purposes, like lambda functions.
 *
 * @param param.cxId - Customer ID
 * @param param.dbCreds - Database credentials
 * @param param.dbUsersToCreateAndGrantAccess - Additional users to create and grant access to
 *                                              the database
 */
export async function setupCustomerAnalyticsDb({
  cxId,
  dbCreds,
  dbUsersToCreateAndGrantAccess,
}: {
  cxId: string;
  dbCreds: DbCredsWithSchema;
  dbUsersToCreateAndGrantAccess: UsersToCreateAndGrantAccess | undefined;
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
    log(`Disconnected from main database, connecting to customer database...`);

    dbClient = new Client({
      host: dbCreds.host,
      port: dbCreds.port,
      database: cxDbName,
      user: dbCreds.username,
      password: dbCreds.password,
    });
    await dbClient.connect();
    log(`Connected to database`);
    await initializeDbInstanceIfNeeded({ dbClient, log });
    await createShemaAnalyticsDb({ dbClient, schemaName: dbCreds.schemaName, log });
    if (dbUsersToCreateAndGrantAccess) {
      await createUsersInAnalyticsDb({
        dbClient,
        dbName: cxDbName,
        schemaName: dbCreds.schemaName,
        dbUsersToCreateAndGrantAccess,
      });
    }
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
  if (Config.isDev()) return;
  await installAwsS3Extension({ dbClient, log });
}

async function installAwsS3Extension({
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
}

async function createShemaAnalyticsDb({
  dbClient,
  schemaName,
  log,
}: {
  dbClient: Client;
  schemaName: string;
  log: typeof console.log;
}): Promise<void> {
  const cmdSchemaExists = getSchemaExistsCommand({ schemaName });
  const schemaExists = await dbClient.query(cmdSchemaExists);
  if (schemaExists.rowCount < 1) {
    const cmdCreate = getCreateSchemaCommand({ schemaName });
    await dbClient.query(cmdCreate);
    log(`Schema ${rawDbSchema} created`);
  } else {
    log(`Schema ${rawDbSchema} already exists`);
  }
}

async function createUsersInAnalyticsDb({
  dbClient,
  dbName,
  schemaName,
  dbUsersToCreateAndGrantAccess,
}: {
  dbClient: Client;
  dbName: string;
  schemaName: string;
  dbUsersToCreateAndGrantAccess: UsersToCreateAndGrantAccess;
}): Promise<void> {
  const { f2c, r2c } = dbUsersToCreateAndGrantAccess;

  const cmdCreateF2c = getCreateDbUserIfNotExistsCommand({
    username: f2c.username,
    password: f2c.password,
  });
  await dbClient.query(cmdCreateF2c);
  const cmdGrantF2c = getGrantAccessToDbUserCommand({ dbName, schemaName, username: f2c.username });
  await dbClient.query(cmdGrantF2c);

  const cmdCreateR2c = getCreateDbUserIfNotExistsCommand({
    username: r2c.username,
    password: r2c.password,
  });
  await dbClient.query(cmdCreateR2c);
  const cmdGrantR2c = getGrantFullAccessToAllSchemasCommand({ dbName, username: r2c.username });
  await dbClient.query(cmdGrantR2c);
}
