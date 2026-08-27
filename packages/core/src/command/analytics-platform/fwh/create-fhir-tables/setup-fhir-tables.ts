/**
 * Creates raw schema tables (job table + partitioned tables + views) for a customer FWH.
 * Used by the create-fhir-tables Lambda (analytics layer with config files).
 * Run after setupCustomerAnalyticsFwh (create DB + schemas) and before FDW setup.
 */
import { DbCreds, errorToString, MetriportError } from "@metriport/shared";
import { Client } from "pg";
import { out } from "../../../../util";
import {
  createExtendedColumnsDefs,
  getCreateIndexIfNotExistsCommand,
  getCreateJobTableIfNotExistsCommand,
  getCreateOrReplaceJobFilterViewCommand,
  getCreatePartitionedTableCommand,
  getCreateLatestMetriportJobsViewCommand,
  getCxFwhName,
  getGrantAccessOnPartitionedTableCommand,
  getGrantAccessOnViewCommand,
  getGrantAccessToIncrementalJobTableCommand,
  getSchemaExistsCommand,
  getSetSchemaCommand,
  getTableExistsCommand,
  getViewExistsCommand,
  TableDefinitions,
  tableJobName,
} from "../utils";

function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export type CreateFhirTablesForCustomerFwhParams = {
  cxId: string;
  dbCreds: DbCreds;
  schemaName: string;
  tablesDefinitions: TableDefinitions;
  grantAccessUsernames: string[];
  useMonthlyDeletedPartitions?: boolean;
};

/**
 * Creates the job table, all partitioned raw tables (from table definitions),
 * indexes, grants, and job filter views in the customer analytics DB.
 */
export async function createFhirTablesForCustomerFwh(
  params: CreateFhirTablesForCustomerFwhParams
): Promise<void> {
  const {
    cxId,
    dbCreds,
    schemaName,
    tablesDefinitions,
    grantAccessUsernames,
    useMonthlyDeletedPartitions = true,
  } = params;
  const { log } = out(`createFhirTablesForCustomerFwh - cx ${cxId}`);
  const cxFwhName = getCxFwhName({ cxId, dbname: dbCreds.dbname });

  const dbClient = new Client({
    host: dbCreds.host,
    port: dbCreds.port,
    database: cxFwhName,
    user: dbCreds.username,
    password: dbCreds.password,
  });

  try {
    await dbClient.connect();
    log(`Connected to customer database ${cxFwhName}`);

    const schemaExistsResult = await dbClient.query(getSchemaExistsCommand(schemaName));
    if (schemaExistsResult.rowCount < 1) {
      throw new MetriportError(`Schema does not exist for Fhir tables creation`, undefined, {
        cxId,
        cxFwhName,
        schemaName,
      });
    }
    await dbClient.query(getSetSchemaCommand(schemaName));

    await createJobTableIfNotExists({
      dbClient,
      schemaName,
      grantAccessUsernames,
      log,
    });

    await createLatestMetriportJobsViewIfNotExists({
      dbClient,
      schemaName,
      grantAccessUsernames,
      log,
    });

    const tableNames = Object.keys(tablesDefinitions);
    for (const tableName of tableNames) {
      const columns = tablesDefinitions[tableName];
      if (!columns || columns.length === 0) {
        log(`Skipping table ${tableName} (no columns)`);
        continue;
      }
      const extendedColumnsDef = createExtendedColumnsDefs(columns);
      await createPartitionedTableIfNotExists({
        dbClient,
        tableName,
        schemaName,
        columnsDef: extendedColumnsDef,
        grantAccessUsernames,
        useMonthlyDeletedPartitions,
        log,
      });
      await createJobFilterViewIfNotExists({
        dbClient,
        tableName,
        schemaName,
        grantAccessUsernames,
        log,
      });
    }
    log(`Fhir tables and views created for ${tableNames.length} tables`);
  } finally {
    try {
      await dbClient.end();
    } catch (error) {
      log(`Error disconnecting: ${errorToString(error)}`);
    }
  }
}

async function createJobTableIfNotExists({
  dbClient,
  schemaName,
  grantAccessUsernames,
  log,
}: {
  dbClient: Client;
  schemaName: string;
  grantAccessUsernames: string[];
  log: (msg: string) => void;
}): Promise<void> {
  const tableExistsCmd = getTableExistsCommand({ schemaName, tableName: tableJobName });
  const tableExistsResult = await dbClient.query(tableExistsCmd);
  if (tableExistsResult.rows[0]?.exists) {
    log(`Incremental job table ${tableJobName} already exists`);
    return;
  }

  const lockKey = hashStringToInt(`${schemaName}.${tableJobName}`);
  await dbClient.query("SELECT pg_advisory_lock($1)", [lockKey]);
  try {
    const tableExistsResultInLock = await dbClient.query(tableExistsCmd);
    if (tableExistsResultInLock.rows[0]?.exists) {
      log(`Incremental job table ${tableJobName} already exists (created by another transaction)`);
      return;
    }
    const cmd = getCreateJobTableIfNotExistsCommand(schemaName);
    await dbClient.query(cmd);
    for (const username of grantAccessUsernames) {
      const grantCmd = getGrantAccessToIncrementalJobTableCommand({ schemaName, username });
      await dbClient.query(grantCmd);
    }
    log(`Incremental job table created`);
  } finally {
    await dbClient.query("SELECT pg_advisory_unlock($1)", [lockKey]);
  }
}

async function createPartitionedTableIfNotExists({
  dbClient,
  tableName,
  schemaName,
  columnsDef,
  grantAccessUsernames,
  useMonthlyDeletedPartitions,
  log,
}: {
  dbClient: Client;
  tableName: string;
  schemaName: string;
  columnsDef: string;
  grantAccessUsernames: string[];
  useMonthlyDeletedPartitions: boolean;
  log: (msg: string) => void;
}): Promise<void> {
  const tableExistsCmd = getTableExistsCommand({ schemaName, tableName });
  const tableExistsResult = await dbClient.query(tableExistsCmd);
  if (tableExistsResult.rows[0]?.exists) {
    log(`Table ${tableName} already exists`);
    return;
  }

  const lockKey = hashStringToInt(`${schemaName}.${tableName}`);
  await dbClient.query("SELECT pg_advisory_lock($1)", [lockKey]);
  try {
    const tableExistsResultInLock = await dbClient.query(tableExistsCmd);
    if (tableExistsResultInLock.rows[0]?.exists) {
      log(`Table ${tableName} already exists (created by another transaction)`);
      return;
    }
    const createTableCmd = getCreatePartitionedTableCommand({
      schemaName,
      tableName,
      columnsDef,
      useMonthlyDeletedPartitions,
    });
    await dbClient.query(createTableCmd);
    const createIndexCmd = getCreateIndexIfNotExistsCommand({ schemaName, tableName });
    await dbClient.query(createIndexCmd);
    for (const username of grantAccessUsernames) {
      const grantCmd = getGrantAccessOnPartitionedTableCommand({
        schemaName,
        tableName,
        username,
      });
      await dbClient.query(grantCmd);
    }
    log(`Table ${tableName} created`);
  } finally {
    await dbClient.query("SELECT pg_advisory_unlock($1)", [lockKey]);
  }
}

async function createLatestMetriportJobsViewIfNotExists({
  dbClient,
  schemaName,
  grantAccessUsernames,
  log,
}: {
  dbClient: Client;
  schemaName: string;
  grantAccessUsernames: string[];
  log: (msg: string) => void;
}): Promise<void> {
  const { cmd, viewName } = getCreateLatestMetriportJobsViewCommand(schemaName);
  const viewExistsCmd = getViewExistsCommand({ schemaName, viewName });

  const viewExistsResult = await dbClient.query(viewExistsCmd);
  if (viewExistsResult.rows[0]?.exists) {
    log(`View ${viewName} already exists`);
    return;
  }

  const lockKey = hashStringToInt(`${schemaName}.${viewName}`);
  await dbClient.query(`SELECT pg_advisory_lock($1)`, [lockKey]);
  try {
    const viewExistsResultInLock = await dbClient.query(viewExistsCmd);
    if (viewExistsResultInLock.rows[0]?.exists) {
      log(`View ${viewName} already exists (created by another transaction)`);
      return;
    }

    await dbClient.query(cmd);
    for (const username of grantAccessUsernames) {
      const grantCmd = getGrantAccessOnViewCommand({
        schemaName,
        viewName,
        username,
      });
      await dbClient.query(grantCmd);
    }
    log(`View created: ${viewName}`);
  } finally {
    await dbClient.query(`SELECT pg_advisory_unlock($1)`, [lockKey]);
  }
}

async function createJobFilterViewIfNotExists({
  dbClient,
  tableName,
  schemaName,
  grantAccessUsernames,
  log,
}: {
  dbClient: Client;
  tableName: string;
  schemaName: string;
  grantAccessUsernames: string[];
  log: (msg: string) => void;
}): Promise<void> {
  const { cmd, viewName } = getCreateOrReplaceJobFilterViewCommand({ schemaName, tableName });
  const viewExistsCmd = getViewExistsCommand({ schemaName, viewName });

  const viewExistsResult = await dbClient.query(viewExistsCmd);
  if (viewExistsResult.rows[0]?.exists) {
    log(`Job filter view ${viewName} already exists`);
    return;
  }

  const lockKey = hashStringToInt(`${schemaName}.${tableName}_view`);
  await dbClient.query(`SELECT pg_advisory_lock($1)`, [lockKey]);
  try {
    const viewExistsResultInLock = await dbClient.query(viewExistsCmd);
    if (viewExistsResultInLock.rows[0]?.exists) {
      log(`Job filter view ${viewName} already exists (created by another transaction)`);
      return;
    }

    await dbClient.query(cmd);
    for (const username of grantAccessUsernames) {
      const grantCmd = getGrantAccessOnViewCommand({
        schemaName,
        viewName,
        username,
      });
      await dbClient.query(grantCmd);
    }
    log(`Job filter view created: ${viewName}`);
  } finally {
    await dbClient.query(`SELECT pg_advisory_unlock($1)`, [lockKey]);
  }
}
