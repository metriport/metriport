export const rawDbSchema = "raw";

export const tableJobName = "metriport_incremental_job";

export const columnPatientIdName = "m_patient_id";
export const columnJobIdName = "m_job_id";

const defaultColumnType = "VARCHAR";

const indexSuffixName = "idx_brin";

export const columnPatientIdDefinition = `${columnPatientIdName} ${defaultColumnType}`;
export const columnJobIdDefinition = `${columnJobIdName} ${defaultColumnType}`;

export const additionalColumnDefs = `${columnPatientIdDefinition}, ${columnJobIdDefinition}`;

export const createTableJobCommand =
  `CREATE TABLE IF NOT EXISTS ${tableJobName} (` +
  `id VARCHAR PRIMARY KEY, ${columnPatientIdDefinition})`;

export const insertTableJobCommand = `INSERT INTO ${tableJobName} (id, ${columnPatientIdName}) VALUES ($1, $2)`;

export function getCreateTableCommand(tableName: string, columnsDef: string): string {
  return (
    `CREATE TABLE IF NOT EXISTS ${tableName} (${columnsDef}) PARTITION BY RANGE (${columnJobIdName}); ` +
    `CREATE TABLE IF NOT EXISTS ${tableName}_default PARTITION OF ${tableName} DEFAULT; ` +
    `CREATE TABLE IF NOT EXISTS ${tableName}_01 PARTITION OF ${tableName} FOR VALUES FROM ('20230101') TO ('20250930');` +
    `CREATE TABLE IF NOT EXISTS ${tableName}_02 PARTITION OF ${tableName} FOR VALUES FROM ('20250930') TO ('20251031');` +
    `CREATE TABLE IF NOT EXISTS ${tableName}_03 PARTITION OF ${tableName} FOR VALUES FROM ('20251031') TO ('20251130');` +
    `CREATE TABLE IF NOT EXISTS ${tableName}_04 PARTITION OF ${tableName} FOR VALUES FROM ('20251130') TO ('20251231');` +
    `CREATE TABLE IF NOT EXISTS ${tableName}_05 PARTITION OF ${tableName} FOR VALUES FROM ('20251231') TO ('20260131');` +
    `CREATE TABLE IF NOT EXISTS ${tableName}_06 PARTITION OF ${tableName} FOR VALUES FROM ('20260131') TO ('20260229');` +
    `CREATE TABLE IF NOT EXISTS ${tableName}_07 PARTITION OF ${tableName} FOR VALUES FROM ('20260229') TO ('20260331');` +
    `CREATE TABLE IF NOT EXISTS ${tableName}_08 PARTITION OF ${tableName} FOR VALUES FROM ('20260331') TO ('20260430');` +
    `CREATE TABLE IF NOT EXISTS ${tableName}_09 PARTITION OF ${tableName} FOR VALUES FROM ('20260430') TO ('20260531');` +
    `CREATE TABLE IF NOT EXISTS ${tableName}_10 PARTITION OF ${tableName} FOR VALUES FROM ('20260531') TO ('20260630');`
  );
}

export function getCreateViewJobCommand(tableName: string): { cmd: string; viewName: string } {
  const viewName = `${tableName}_view`;
  const cmd = `CREATE or replace VIEW ${viewName} as
          SELECT a.*
          FROM ${tableName} a
            join ${tableJobName} j on
              a.${columnJobIdName} = j.id and 
              a.${columnPatientIdName} = j.${columnPatientIdName}
          WHERE j.id = (
            select max(id) from ${tableJobName} jj
            where jj.${columnPatientIdName} = a.${columnPatientIdName}
          );`;
  return { cmd, viewName };
}

export function getCreateIndexCommand(tableName: string): string {
  return (
    `CREATE INDEX IF NOT EXISTS ${tableName}_${indexSuffixName} ` +
    `ON ${tableName} USING BRIN (${columnJobIdName})`
  );
}
export function getDropIndexCommand(tableName: string): string {
  return `DROP INDEX IF EXISTS ${tableName}_${indexSuffixName}`;
}

export function getInsertTableCommand(tableName: string, columnNames: string[]): string {
  const valuesPlaceholders = columnNames.map((_, index) => `$${index + 1}`).join(", ");
  const insertQuery = `
    INSERT INTO ${tableName} (${columnNames.join(", ")})
    VALUES (${valuesPlaceholders})
  `;
  return insertQuery;
}

export function getCxDbName(cxId: string, dbname: string): string {
  return `${dbname}_${cxId.replace(/-/g, "_")}`;
}

export function getCreateCxDbCommand({ cxDbName }: { cxDbName: string }): string {
  return `CREATE DATABASE "${cxDbName}"`;
}
export function getCxDbExistsCommand({ cxDbName }: { cxDbName: string }): string {
  return `SELECT 1 FROM pg_database WHERE datname = '${cxDbName}'`;
}
export function getCreateSchemaCommand({ schemaName }: { schemaName: string }): string {
  return `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`;
}
export function getSchemaExistsCommand({ schemaName }: { schemaName: string }): string {
  return `SELECT TRUE FROM information_schema.schemata WHERE schema_name = '${schemaName}'`;
}

export function getCreateDbUserIfNotExistsCommand({
  username,
  password,
}: {
  username: string;
  password: string;
}): string {
  const cmd = `DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_user WHERE usename = '${username}') THEN
            CREATE USER ${username} WITH PASSWORD '${password}';
        END IF;
    END
    $$;`;
  return cmd;
}

export function getGrantAccessToDbUserCommand({
  dbName,
  schemaName,
  username,
}: {
  dbName: string;
  schemaName: string;
  username: string;
}): string {
  const cmd = `GRANT CONNECT ON DATABASE ${dbName} TO ${username};
    GRANT USAGE ON SCHEMA ${schemaName} TO ${username};
    grant all on schema ${schemaName} to ${username};
    grant all on all tables in schema ${schemaName} to ${username};
    grant all on all sequences in schema ${schemaName} to ${username};
    grant all on all functions in schema ${schemaName} to ${username};
    grant all on all procedures in schema ${schemaName} to ${username};
    grant all on all routines in schema ${schemaName} to ${username};
    ALTER DEFAULT PRIVILEGES IN SCHEMA ${schemaName} GRANT ALL ON TABLES TO ${username};
    ALTER DEFAULT PRIVILEGES IN SCHEMA ${schemaName} GRANT ALL ON FUNCTIONS TO ${username};
    `;
  return cmd;
}
