import { validateIdentifier, validatePassword } from "../../../util/db";

export const rawDbSchema = "raw";
export const rawStageSchema = "stage";
export const coreDbSchema = "core";
export const jobDbSchema = "job";

export const tableJobName = "metriport_incremental_job";
export const latestMetriportJobsViewName = "latest_metriport_incremental_job";

export const jobPatientIdColumnName = "m_patient_id";
export const jobJobIdColumnName = "m_job_id";
export const createdAtColumnName = "m_created_at";
export const updatedAtColumnName = "m_updated_at";
export const deletedAtColumnName = "m_deleted_at";
export const incrementalDeletedAtColumnName = "m_incremental_deleted_at";

export const corePatientIdColumnName = "patient_id";

const defaultColumnType = "VARCHAR";
const defaultTimestampColumnType = "TIMESTAMP";
const defaultTimestampColumnTypeWithDefault = `${defaultTimestampColumnType} DEFAULT CURRENT_TIMESTAMP`;

export const jobPatientIdDefinition = `"${jobPatientIdColumnName}" ${defaultColumnType}`;
export const jobJobIdDefinition = `"${jobJobIdColumnName}" ${defaultColumnType}`;
export const createdAtDefinition = `"${createdAtColumnName}" ${defaultTimestampColumnTypeWithDefault}`;
export const updatedAtDefinition = `"${updatedAtColumnName}" ${defaultTimestampColumnTypeWithDefault}`;
export const deletedAtDefinition = `"${deletedAtColumnName}" ${defaultTimestampColumnType}`;
export const incrementalDeletedAtDefinition = `"${incrementalDeletedAtColumnName}" ${defaultTimestampColumnType}`;
export const additionalColumnDefs = `${jobPatientIdDefinition}, ${jobJobIdDefinition}, ${createdAtDefinition}, ${updatedAtDefinition}, ${deletedAtDefinition}, ${incrementalDeletedAtDefinition}`;

export function appendFdwSchemaSuffix(schemaName: string): string {
  validateIdentifier(schemaName, "schema name");
  return `${schemaName}_fdw`;
}

export type TableDefinitions = Record<string, string[]>;

export function getCreateJobTableIfNotExistsCommand(schemaName: string): string {
  validateIdentifier(schemaName, "schema name");
  return (
    `CREATE TABLE IF NOT EXISTS "${schemaName}"."${tableJobName}" (` +
    `"id" VARCHAR PRIMARY KEY, ${jobPatientIdDefinition}, ${createdAtDefinition}); ` +
    // Composite index for efficient max(id) per patient lookup used by views
    `CREATE INDEX IF NOT EXISTS "${tableJobName}_patient_id_idx" ON "${schemaName}"."${tableJobName}" ("${jobPatientIdColumnName}", "id")`
  );
}
export function getInsertTableJobCommand(schemaName: string): string {
  validateIdentifier(schemaName, "schema name");
  return `INSERT INTO "${schemaName}"."${tableJobName}" ("id", "${jobPatientIdColumnName}") VALUES ($1, $2)`;
}
export function getGrantAccessToIncrementalJobTableCommand({
  schemaName,
  username,
}: {
  schemaName: string;
  username: string;
}): string {
  validateIdentifier(schemaName, "schema name");
  validateIdentifier(username, "username");
  return `GRANT ALL ON "${schemaName}"."${tableJobName}" TO "${username}"`;
}

export function getCreatePartitionedTableCommand({
  schemaName,
  tableName,
  columnsDef,
  useMonthlyDeletedPartitions = true,
}: {
  schemaName: string;
  tableName: string;
  columnsDef: string;
  /** Set to false for local dev to use a single deleted partition instead of monthly partitions */
  useMonthlyDeletedPartitions?: boolean;
}): string {
  validateIdentifier(schemaName, "schema name");
  validateIdentifier(tableName, "table name");

  let cmd =
    `CREATE TABLE IF NOT EXISTS "${schemaName}"."${tableName}" (${columnsDef}) PARTITION BY RANGE ("${incrementalDeletedAtColumnName}"); ` +
    // Active partition (DEFAULT) catches NULL values and any timestamps before 2025
    `CREATE TABLE IF NOT EXISTS "${schemaName}"."${tableName}_active" PARTITION OF "${schemaName}"."${tableName}" DEFAULT; `;

  // For local dev, use a single deleted partition instead of 120+ monthly partitions
  if (!useMonthlyDeletedPartitions) {
    // Single partition for all deleted rows (2025-2099)
    cmd +=
      `CREATE TABLE IF NOT EXISTS "${schemaName}"."${tableName}_deleted" ` +
      `PARTITION OF "${schemaName}"."${tableName}" ` +
      `FOR VALUES FROM ('2025-01-01') TO ('2099-12-31'); `;
    return cmd;
  }

  // Generate monthly partitions for the next 5 years (2026-2030)
  const startYear = 2026;
  const endYear = 2030;
  for (let year = startYear; year <= endYear; year++) {
    for (let month = 1; month <= 12; month++) {
      const monthStr = month.toString().padStart(2, "0");
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const nextMonthStr = nextMonth.toString().padStart(2, "0");

      cmd +=
        `CREATE TABLE IF NOT EXISTS "${schemaName}"."${tableName}_del_${year}${monthStr}" ` +
        `PARTITION OF "${schemaName}"."${tableName}" ` +
        `FOR VALUES FROM ('${year}-${monthStr}-01') TO ('${nextYear}-${nextMonthStr}-01'); `;
    }
  }

  return cmd;
}
export function getDropDeletedPartitionCommand({
  schemaName,
  tableName,
  year,
  month,
}: {
  schemaName: string;
  tableName: string;
  year: number;
  month: number;
}): string {
  validateIdentifier(schemaName, "schema name");
  validateIdentifier(tableName, "table name");
  const monthStr = month.toString().padStart(2, "0");
  return `DROP TABLE IF EXISTS "${schemaName}"."${tableName}_del_${year}${monthStr}"`;
}
export function getTableExistsCommand({
  schemaName,
  tableName,
}: {
  schemaName: string;
  tableName: string;
}): string {
  validateIdentifier(schemaName, "schema name");
  validateIdentifier(tableName, "table name");
  return `SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = '${schemaName}' AND table_name = '${tableName}'
  )`;
}
export function getViewExistsCommand({
  schemaName,
  viewName,
}: {
  schemaName: string;
  viewName: string;
}): string {
  validateIdentifier(schemaName, "schema name");
  validateIdentifier(viewName, "view name");
  return `SELECT EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = '${schemaName}' AND table_name = '${viewName}'
  )`;
}
export function getExistingColumnsCommand({
  schemaName,
  tableName,
}: {
  schemaName: string;
  tableName: string;
}): string {
  validateIdentifier(schemaName, "schema name");
  validateIdentifier(tableName, "table name");
  return `SELECT column_name 
  FROM information_schema.columns 
  WHERE table_schema = '${schemaName}' AND table_name = '${tableName}'`;
}
export function getAddMissingColumnsToTableCommand({
  schemaName,
  tableName,
  columnName,
}: {
  schemaName: string;
  tableName: string;
  columnName: string;
}): string {
  validateIdentifier(schemaName, "schema name");
  validateIdentifier(tableName, "table name");
  validateIdentifier(columnName, "column name");
  return `ALTER TABLE "${schemaName}"."${tableName}" ADD COLUMN ${createDefaultColumnDef(
    columnName
  )}`;
}
export function getParameterizedInsertRowsIntoTableCommand({
  tableName,
  columnNames,
  rows,
}: {
  tableName: string;
  columnNames: string[];
  rows: string[][];
}): string {
  validateIdentifier(tableName, "table name");
  columnNames.forEach(columnName => validateIdentifier(columnName, "column name"));
  // Create VALUES clause with placeholders for batch insert
  const valuesClauses = rows.map((row, rowIndex) => {
    const rowPlaceholders = [];
    for (let colIndex = 0; colIndex < columnNames.length; colIndex++) {
      const paramIndex = rowIndex * columnNames.length + colIndex + 1;
      rowPlaceholders.push(`$${paramIndex}`);
    }
    return `(${rowPlaceholders.join(", ")})`;
  });
  const quotedColumnNames = columnNames.map(col => `"${col}"`).join(", ");
  return `INSERT INTO "${tableName}" (${quotedColumnNames}) VALUES ${valuesClauses.join(", ")}`;
}
export function getListTableNames(schemaName: string): string {
  validateIdentifier(schemaName, "schema name");
  const cmd = `SELECT n.nspname AS "schema", c.relname as name
    FROM pg_class c
      join pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r','p')
      AND NOT c.relispartition
      AND n.nspname !~ ALL ('{^pg_,^information_schema$}')
      AND n.nspname = '${schemaName}'
      order by 2`;
  return cmd;
}

export function getCreateOrReplaceJobFilterViewCommand({
  schemaName,
  tableName,
}: {
  schemaName: string;
  tableName: string;
}): { cmd: string; viewName: string } {
  validateIdentifier(schemaName, "schema name");
  validateIdentifier(tableName, "table name");
  const viewName = `${tableName}_view`;
  const cmd = `CREATE OR REPLACE VIEW "${schemaName}"."${viewName}" as
          SELECT a.*
          FROM "${schemaName}"."${tableName}" a
          INNER JOIN (
            SELECT "${jobPatientIdColumnName}", max("id") as max_job_id
            FROM "${schemaName}"."${tableJobName}"
            GROUP BY "${jobPatientIdColumnName}"
          ) latest_jobs ON a."${jobPatientIdColumnName}" = latest_jobs."${jobPatientIdColumnName}"
            AND a."${jobJobIdColumnName}" = latest_jobs.max_job_id
          WHERE a."${incrementalDeletedAtColumnName}" IS NULL;`;
  return { cmd, viewName };
}

export function getCreateLatestMetriportJobsViewCommand(schemaName: string): {
  cmd: string;
  viewName: string;
} {
  validateIdentifier(schemaName, "schema name");
  const viewName = latestMetriportJobsViewName;
  const cmd = `CREATE OR REPLACE VIEW "${schemaName}"."${viewName}" AS
    SELECT *
    FROM (
        SELECT
            *,
            MAX(id) OVER (PARTITION BY "${jobPatientIdColumnName}") as max_job_id
        FROM "${schemaName}"."${tableJobName}"
    ) sub
    WHERE id = max_job_id`;
  return { cmd, viewName };
}

export function getCreateIndexIfNotExistsCommand({
  schemaName,
  tableName,
}: {
  schemaName: string;
  tableName: string;
}): string {
  validateIdentifier(schemaName, "schema name");
  validateIdentifier(tableName, "table name");
  return (
    // Index for querying by patient and job (used by views and queries)
    `CREATE INDEX IF NOT EXISTS "${tableName}_patient_job_idx" ` +
    `ON "${schemaName}"."${tableName}" ("${jobPatientIdColumnName}", "${jobJobIdColumnName}"); ` +
    // Index for soft delete queries: finding active rows for a patient to mark as deleted
    `CREATE INDEX IF NOT EXISTS "${tableName}_patient_deleted_idx" ` +
    `ON "${schemaName}"."${tableName}" ("${jobPatientIdColumnName}", "${incrementalDeletedAtColumnName}") ` +
    `WHERE "${incrementalDeletedAtColumnName}" IS NULL;`
  );
}
export function getDropIndexCommand({
  schemaName,
  tableName,
}: {
  schemaName: string;
  tableName: string;
}): string {
  validateIdentifier(schemaName, "schema name");
  validateIdentifier(tableName, "table name");
  return (
    `DROP INDEX IF EXISTS "${schemaName}"."${tableName}_pk_idx"; ` +
    `DROP INDEX IF EXISTS "${schemaName}"."${tableName}_patient_job_idx"; ` +
    `DROP INDEX IF EXISTS "${schemaName}"."${tableName}_patient_deleted_idx";`
  );
}

export function getCxFwhName({ cxId, dbname }: { cxId: string; dbname: string }): string {
  return `${dbname}_${cxId.replace(/-/g, "_")}`;
}

export function getCreateCxDbCommand(cxFwhName: string): string {
  validateIdentifier(cxFwhName, "database name");
  return `CREATE DATABASE "${cxFwhName}"`;
}
export function getCxDbExistsCommand(cxFwhName: string): string {
  validateIdentifier(cxFwhName, "database name");
  return `SELECT 1 FROM pg_database WHERE datname = '${cxFwhName}'`;
}

export function getCreateSchemaCommand(schemaName: string): string {
  validateIdentifier(schemaName, "schema name");
  return `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`;
}
export function getSchemaExistsCommand(schemaName: string): string {
  validateIdentifier(schemaName, "schema name");
  return `SELECT TRUE FROM information_schema.schemata WHERE schema_name = '${schemaName}'`;
}
export function getSetSchemaCommand(schemaName: string): string {
  validateIdentifier(schemaName, "schema name");
  return `SET search_path TO "${schemaName}"`;
}

export function getCreateOrUpdateDbUserCommand({
  username,
  password,
}: {
  username: string;
  password: string;
}): string {
  validateIdentifier(username, "username");
  validatePassword(password);
  const cmd = `DO $$
    DECLARE
        target_password text := '${password}';
        target_user text := '${username}';
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_user WHERE usename = target_user) THEN
            EXECUTE format('CREATE USER %I WITH PASSWORD %L', target_user, target_password);
        ELSE
            EXECUTE format('ALTER USER %I WITH PASSWORD %L', target_user, target_password);
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
  validateIdentifier(dbName, "database name");
  validateIdentifier(schemaName, "schema name");
  validateIdentifier(username, "username");
  const cmd = `GRANT CONNECT ON DATABASE "${dbName}" TO "${username}";
    GRANT USAGE ON SCHEMA "${schemaName}" TO "${username}";
    GRANT ALL ON SCHEMA "${schemaName}" TO "${username}";
    GRANT ALL ON ALL TABLES IN SCHEMA "${schemaName}" TO "${username}";
    GRANT ALL ON ALL SEQUENCES IN SCHEMA "${schemaName}" TO "${username}";
    GRANT ALL ON ALL ROUTINES IN SCHEMA "${schemaName}" TO "${username}";
    ALTER DEFAULT PRIVILEGES IN SCHEMA "${schemaName}" GRANT ALL ON TABLES TO "${username}";
    ALTER DEFAULT PRIVILEGES IN SCHEMA "${schemaName}" GRANT ALL ON SEQUENCES TO "${username}";
    ALTER DEFAULT PRIVILEGES IN SCHEMA "${schemaName}" GRANT ALL ON ROUTINES TO "${username}";
    `;
  return cmd;
}
export function getGrantAccessOnViewCommand({
  schemaName,
  viewName,
  username,
}: {
  schemaName: string;
  viewName: string;
  username: string;
}): string {
  validateIdentifier(schemaName, "schema name");
  validateIdentifier(viewName, "view name");
  validateIdentifier(username, "username");
  return `GRANT ALL ON "${schemaName}"."${viewName}" TO "${username}";`;
}
export function getGrantAccessOnPartitionedTableCommand({
  schemaName,
  tableName,
  username,
}: {
  schemaName: string;
  tableName: string;
  username: string;
}): string {
  validateIdentifier(schemaName, "schema name");
  validateIdentifier(tableName, "table name");
  validateIdentifier(username, "username");

  // Use dynamic SQL to grant on all existing partitions
  // Use explicit partition naming patterns to avoid matching unrelated tables
  // (e.g., 'condition_%' would incorrectly match 'condition_code_coding' due to _ being a wildcard)
  return `
    DO $$
    DECLARE
      r RECORD;
    BEGIN
      FOR r IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = '${schemaName}' 
          AND (
            tablename = '${tableName}'
            OR tablename = '${tableName}_active'
            OR tablename = '${tableName}_deleted'
            OR tablename LIKE '${tableName}\\_del\\_%' ESCAPE '\\'
          )
      LOOP
        EXECUTE 'GRANT ALL ON "${schemaName}".' || quote_ident(r.tablename) || ' TO "${username}"';
      END LOOP;
    END $$;
  `;
}

export function createDefaultColumnDef(columnName: string): string {
  validateIdentifier(columnName, "column name");
  return `"${columnName}" ${defaultColumnType}`;
}
export function createExtendedColumnsDefs(columnDefinitions: string[]): string {
  const columnsDefs = columnDefinitions.map(column => createDefaultColumnDef(column)).join(", ");
  return `${columnsDefs}, ${additionalColumnDefs}`;
}
export function appendExtendedColumnNamesToRow(row: string[]): string[] {
  return [...row, jobPatientIdColumnName, jobJobIdColumnName];
}
export function appendExtendedColumnValuesToRow({
  row,
  patientId,
  jobId,
}: {
  row: string[];
  patientId: string;
  jobId: string;
}): string[] {
  return [...row, patientId, jobId];
}

export function getMarkOldRowsAsDeletedCommand({
  schemaName,
  tableName,
}: {
  schemaName: string;
  tableName: string;
}): string {
  validateIdentifier(schemaName, "schema name");
  validateIdentifier(tableName, "table name");
  return `
    UPDATE "${schemaName}"."${tableName}"
    SET "${incrementalDeletedAtColumnName}" = CURRENT_TIMESTAMP,
        "${updatedAtColumnName}" = CURRENT_TIMESTAMP
    WHERE "${jobPatientIdColumnName}" = $1
      AND "${jobJobIdColumnName}" != $2
      AND "${incrementalDeletedAtColumnName}" IS NULL
  `;
}

export function getColumnNamesCommand({
  schemaName,
  tableName,
}: {
  schemaName: string;
  tableName: string;
}): string {
  validateIdentifier(schemaName, "schema name");
  validateIdentifier(tableName, "table name");

  return `select column_name from information_schema.columns 
    where table_schema = '${schemaName}'
    and table_name = '${tableName}'
    order by ordinal_position`;
}
