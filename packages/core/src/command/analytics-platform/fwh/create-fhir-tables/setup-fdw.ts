import { DbCreds, errorToString, MetriportError, sleep } from "@metriport/shared";
import { Client } from "pg";
import { out } from "../../../../util";
import { validateIdentifier } from "../../../../util/db";
import { SingleUserAndPasswordAndSchemas } from "../setup-cx-fwh";
import {
  appendFdwSchemaSuffix,
  getCxFwhName,
  getGrantAccessToDbUserCommand,
  getSchemaExistsCommand,
  getSetSchemaCommand,
  tableJobName,
  latestMetriportJobsViewName,
} from "../utils";

const fdwServerName = "aurora_reader";

const fdwImportBatchSize = 25;
const fdwImportDelayBetweenBatchesMs = 500;

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function buildLimitToClause(tableNames: string[]): string {
  if (tableNames.length === 0) return "";
  return (
    " LIMIT TO (" +
    tableNames
      .map(name => {
        validateIdentifier(name, "raw table name for import");
        return `"${name.replace(/"/g, '""')}"`;
      })
      .join(", ") +
    ")"
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export type SetupFdwParams = {
  cxId: string;
  dbCreds: DbCreds;
  readerHost: string;
  readerCname: string;
  readerPort: number;
  dbName: string;
  schemaName: string;
  dbUsersToGrantAccess: Omit<SingleUserAndPasswordAndSchemas, "schemaNames">[];
};

export async function setupFdwForCustomerFwh(params: SetupFdwParams): Promise<void> {
  const {
    cxId,
    dbCreds,
    readerHost,
    readerCname,
    readerPort,
    dbName,
    schemaName,
    dbUsersToGrantAccess,
  } = params;
  const { log } = out(`setupFdwForCustomerFwh - cx ${cxId}`);
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
      throw new MetriportError(`Schema does not exist for FDW setup`, undefined, {
        cxId,
        cxFwhName,
        schemaName,
      });
    }
    await dbClient.query(getSetSchemaCommand(schemaName));

    const fdwLocalSchema = appendFdwSchemaSuffix(schemaName);

    await dbClient.query("CREATE EXTENSION IF NOT EXISTS postgres_fdw");
    log("postgres_fdw extension ready");

    await dbClient.query(`DROP SCHEMA IF EXISTS "${fdwLocalSchema}" CASCADE`);
    await dbClient.query(`DROP SERVER IF EXISTS "${fdwServerName}" CASCADE`);
    log(`Dropped existing ${fdwLocalSchema} and server ${fdwServerName} (if any)`);

    await dbClient.query(
      `CREATE SERVER "${fdwServerName}" FOREIGN DATA WRAPPER postgres_fdw ` +
        `OPTIONS (host '${escapeSqlLiteral(readerCname)}', port '${escapeSqlLiteral(
          String(readerPort)
        )}', dbname '${escapeSqlLiteral(dbName)}', sslmode 'require', ` +
        `use_remote_estimate 'on', extensions 'postgres_fdw', fetch_size '10000')`
    );
    log(`Created server ${fdwServerName} -> ${readerCname}:${readerPort}/${dbName}`);

    // Mapping for the connection user is required before IMPORT FOREIGN SCHEMA (runs as current user).
    await dbClient.query(
      `CREATE USER MAPPING FOR "${dbCreds.username}" SERVER "${fdwServerName}" ` +
        `OPTIONS (user '${escapeSqlLiteral(dbCreds.username)}', password '${escapeSqlLiteral(
          dbCreds.password
        )}')`
    );
    log(`Created user mapping for connection user ${dbCreds.username}`);

    let tableNamesForImport: string[] = [];
    const readerClient = new Client({
      host: readerHost,
      port: readerPort,
      database: dbName,
      user: dbCreds.username,
      password: dbCreds.password,
    });
    try {
      await readerClient.connect();
      const tablesResult = await readerClient.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
        [schemaName]
      );
      if (tablesResult.rows.length > 0) {
        const allTables = tablesResult.rows.map(r => r.table_name as string);
        const activeSuffix = "_active";
        tableNamesForImport = allTables.filter(
          name =>
            name === tableJobName ||
            name === latestMetriportJobsViewName ||
            name.endsWith(activeSuffix)
        );
        log(
          `Found ${tableNamesForImport.length} relations in remote ${schemaName} (${allTables.length} total, importing ${tableJobName} + ${latestMetriportJobsViewName} + *_active)`
        );
      }
      if (tableNamesForImport.length === 0) {
        log(`No tables found in remote ${schemaName} for LIMIT TO`);
        return;
      }
    } catch (error) {
      log(`Could not fetch remote table list (using config list): ${errorToString(error)}`);
      throw new MetriportError(`Could not fetch remote table list`, error, {
        cxId,
        cxFwhName,
        schemaName,
      });
    } finally {
      try {
        await readerClient.end();
      } catch (error) {
        log(`Error disconnecting reader client: ${errorToString(error)}`);
      }
    }

    await dbClient.query(`CREATE SCHEMA IF NOT EXISTS "${fdwLocalSchema}"`);
    const batches =
      tableNamesForImport.length > 0 ? chunk(tableNamesForImport, fdwImportBatchSize) : [[]];
    const totalBatches = batches.length;
    for (const [idx, batch] of batches.entries()) {
      await dbClient.query("SELECT 1"); // keepalive to avoid connection dropped during long import
      const limitToClause = buildLimitToClause(batch);
      const batchNum = idx + 1;
      const tableRange =
        totalBatches > 1
          ? ` (tables ${idx * fdwImportBatchSize + 1}-${Math.min(
              (idx + 1) * fdwImportBatchSize,
              tableNamesForImport.length
            )} of ${tableNamesForImport.length})`
          : "";
      log(`Importing foreign schema batch ${batchNum}/${totalBatches}${tableRange}...`);
      try {
        await dbClient.query(
          `IMPORT FOREIGN SCHEMA "${schemaName}"${limitToClause} FROM SERVER "${fdwServerName}" INTO "${fdwLocalSchema}"`
        );
        log(`Imported batch ${batchNum}/${totalBatches} (${batch.length} tables)`);
        if (batchNum < totalBatches) {
          log(`Waiting ${fdwImportDelayBetweenBatchesMs}ms before next batch...`);
          await sleep(fdwImportDelayBetweenBatchesMs);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("does not exist") || msg.includes("schema")) {
          log(
            `Remote schema ${schemaName} empty or not yet present on reader; ${fdwLocalSchema} created empty (re-run enable or refresh-fdw when raw has tables)`
          );
          break;
        }
        throw new MetriportError(`Could not import foreign schema`, error, {
          cxId,
          cxFwhName,
          schemaName,
          batchNum,
        });
      }
    }
    if (tableNamesForImport.length > 0) {
      log(
        `Imported foreign schema ${schemaName} -> ${fdwLocalSchema} (${tableNamesForImport.length} tables total)`
      );
    }

    for (const user of dbUsersToGrantAccess) {
      if (user.username !== dbCreds.username) {
        await dbClient.query(
          `CREATE USER MAPPING FOR "${user.username}" SERVER "${fdwServerName}" ` +
            `OPTIONS (user '${escapeSqlLiteral(user.username)}', password '${escapeSqlLiteral(
              user.password
            )}')`
        );
        log(`Created user mapping for ${user.username}`);
      }
      const cmdGrant = getGrantAccessToDbUserCommand({
        dbName,
        schemaName: fdwLocalSchema,
        username: user.username,
      });
      await dbClient.query(cmdGrant);
      log(`Granted ${user.username} access to schema ${fdwLocalSchema}`);
    }

    log("FDW setup complete");
  } finally {
    try {
      await dbClient.end();
    } catch (error) {
      log(`Error disconnecting: ${errorToString(error)}`);
    }
  }
}
