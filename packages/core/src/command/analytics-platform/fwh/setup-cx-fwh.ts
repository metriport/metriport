import { Client } from "pg";
import { capture, out } from "../../../util";
import { Config } from "../../../util/config";
import { errorToString } from "../../../util/error/shared";
import { buildCreateFhirTablesHandler } from "./create-fhir-tables/create-fhir-tables-factory";
import {
  coreDbSchema,
  getCreateCxDbCommand,
  getCreateOrUpdateDbUserCommand,
  getCreateSchemaCommand,
  getCxFwhName,
  getGrantAccessToDbUserCommand,
  getSchemaExistsCommand,
  jobDbSchema,
  rawDbSchema,
  rawStageSchema,
} from "./utils";

export type SingleUserAndPasswordAndSchemas = {
  username: string;
  password: string;
  schemaNames: string[];
};

export type SingleUserAndPasswordAndSchema = Omit<
  SingleUserAndPasswordAndSchemas,
  "schemaNames"
> & {
  schemaName: string;
};

/**
 * Creates the customer analytics database in the main analytics DB instance, and set it up
 * for usage.
 *
 * It also creates the additional schemas and users.
 *
 * @param param.cxId - Customer ID
 */
export async function setupCustomerAnalyticsFwh({ cxId }: { cxId: string }): Promise<void> {
  const { log } = out(`setupCustomerAnalyticsFwh - cx ${cxId}`);
  const dbCreds = Config.getAnalyticsDbCreds();
  const fhirToCsvUsername = Config.getFhirToCsvDbUsername();
  const fhirToCsvPassword = Config.getFhirToCsvDbPassword();
  const rawToCoreUsername = Config.getRawToCoreDbUsername();
  const rawToCorePassword = Config.getRawToCoreDbPassword();
  const cxFwhName = getCxFwhName({ cxId, dbname: dbCreds.dbname });
  capture.setExtra({ cxId, cxFwhName });
  log(
    `Running with params: ${JSON.stringify({
      host: dbCreds.host,
      port: dbCreds.port,
      dbname: dbCreds.dbname,
      cxFwhName,
      username: dbCreds.username,
    })}`
  );

  const dbUsersToCreateAndGrantAccess: SingleUserAndPasswordAndSchemas[] = [
    { username: fhirToCsvUsername, password: fhirToCsvPassword, schemaNames: [rawDbSchema] },
    {
      username: rawToCoreUsername,
      password: rawToCorePassword,
      schemaNames: [rawDbSchema, rawStageSchema, coreDbSchema, jobDbSchema],
    },
  ];

  let mainDbClient: Client | undefined;
  let customerDbClient: Client | undefined;
  try {
    mainDbClient = new Client({
      host: dbCreds.host,
      port: dbCreds.port,
      database: dbCreds.dbname,
      user: dbCreds.username,
      password: dbCreds.password,
    });
    await mainDbClient.connect();
    log(`Connected to main database`);
    await createIfNotExistsCustomerAnalyticsDb({ dbClient: mainDbClient, cxFwhName, log });
    await mainDbClient.end();
    mainDbClient = undefined;
    log(`Disconnected from main database, connecting to customer database...`);

    customerDbClient = new Client({
      host: dbCreds.host,
      port: dbCreds.port,
      database: cxFwhName,
      user: dbCreds.username,
      password: dbCreds.password,
    });
    await customerDbClient.connect();
    log(`Connected to customer database`);
    await initializeDbInstanceIfNeeded({ dbClient: customerDbClient, log });
    await createSchemasAndUsersInAnalyticsDb({
      dbClient: customerDbClient,
      dbName: cxFwhName,
      dbUsersToCreateAndGrantAccess,
      log,
    });
    await customerDbClient.end();
    customerDbClient = undefined;
    log(`Disconnected from customer database`);
    const handler = buildCreateFhirTablesHandler();
    await handler.createFhirTables({ cxId });
  } finally {
    try {
      if (mainDbClient) {
        await mainDbClient.end();
        log(`Disconnected from main database`);
      }
    } catch (error) {
      log(`Error disconnecting from main database: ${errorToString(error)}`);
    }
    try {
      if (customerDbClient) {
        await customerDbClient.end();
        log(`Disconnected from customer database`);
      }
    } catch (error) {
      log(`Error disconnecting from customer database: ${errorToString(error)}`);
    }
  }
}

// PostgreSQL error code for "database already exists"
const DUPLICATE_DATABASE_ERROR_CODE = "42P04";

async function createIfNotExistsCustomerAnalyticsDb({
  dbClient,
  cxFwhName,
  log,
}: {
  dbClient: Client;
  cxFwhName: string;
  log: typeof console.log;
}): Promise<void> {
  const cmdCreate = getCreateCxDbCommand(cxFwhName);
  try {
    await dbClient.query(cmdCreate);
    log(`Database ${cxFwhName} created`);
  } catch (error) {
    if (isDuplicateDatabaseError(error)) {
      log(`Database ${cxFwhName} already exists`);
      return;
    }
    throw error;
  }
}

function isDuplicateDatabaseError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === DUPLICATE_DATABASE_ERROR_CODE
  );
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

async function createSchemasAndUsersInAnalyticsDb({
  dbClient,
  dbName,
  dbUsersToCreateAndGrantAccess,
  log,
}: {
  dbClient: Client;
  dbName: string;
  dbUsersToCreateAndGrantAccess: SingleUserAndPasswordAndSchemas[];
  log: typeof console.log;
}): Promise<void> {
  for (const user of dbUsersToCreateAndGrantAccess) {
    const cmdCreateOrUpdateUser = getCreateOrUpdateDbUserCommand({
      username: user.username,
      password: user.password,
    });
    await dbClient.query(cmdCreateOrUpdateUser);
    log(`Created or updated user ${user.username} in analytics database`);
    for (const schemaName of user.schemaNames) {
      await createSchemaIfNotExistsInAnalyticsDb({ dbClient, schemaName, log });
      const cmdGrantUser = getGrantAccessToDbUserCommand({
        dbName,
        schemaName,
        username: user.username,
      });
      await dbClient.query(cmdGrantUser);
      log(`Granted access to schema ${schemaName} to user ${user.username}`);
    }
  }
}

async function createSchemaIfNotExistsInAnalyticsDb({
  dbClient,
  schemaName,
  log,
}: {
  dbClient: Client;
  schemaName: string;
  log: typeof console.log;
}): Promise<void> {
  const cmdSchemaExists = getSchemaExistsCommand(schemaName);
  const schemaExists = await dbClient.query(cmdSchemaExists);
  if (schemaExists.rowCount < 1) {
    const cmdCreate = getCreateSchemaCommand(schemaName);
    await dbClient.query(cmdCreate);
    log(`Schema ${schemaName} created`);
  } else {
    log(`Schema ${schemaName} already exists`);
  }
}
