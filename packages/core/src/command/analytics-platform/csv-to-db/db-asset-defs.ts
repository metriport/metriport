export const rawDbSchema = "raw";

export const tableJobName = "metriport_incremental_job";

export const columnPatientIdName = "m_patient_id";
export const columnJobIdName = "m_job_id";

const defaultColumnType = "VARCHAR";

const indexSuffixName = "idx_brin";

export const columnPatientIdDefinition = `${columnPatientIdName} ${defaultColumnType}`;
export const columnJobIdDefinition = `${columnJobIdName} ${defaultColumnType}`;

export const additionalColumnDefs = `${columnPatientIdDefinition}, ${columnJobIdDefinition}`;

export function getCreateTableJobCommand(schemaName: string): string {
  return (
    `CREATE TABLE IF NOT EXISTS ${schemaName}.${tableJobName} (` +
    `id VARCHAR PRIMARY KEY, ${columnPatientIdDefinition})`
  );
}

export function getInsertTableJobCommand(schemaName: string): string {
  return `INSERT INTO ${schemaName}.${tableJobName} (id, ${columnPatientIdName}) VALUES ($1, $2)`;
}

export function getCreatePartitionedTableCommand(
  schemaName: string,
  tableName: string,
  columnsDef: string
): string {
  return (
    `CREATE TABLE IF NOT EXISTS ${schemaName}.${tableName} (${columnsDef}) PARTITION BY RANGE (${columnJobIdName}); ` +
    `CREATE TABLE IF NOT EXISTS ${schemaName}.${tableName}_default PARTITION OF ${schemaName}.${tableName} DEFAULT; ` +
    `CREATE TABLE IF NOT EXISTS ${schemaName}.${tableName}_01 PARTITION OF ${schemaName}.${tableName} FOR VALUES FROM ('20230101') TO ('20250930');` +
    `CREATE TABLE IF NOT EXISTS ${schemaName}.${tableName}_02 PARTITION OF ${schemaName}.${tableName} FOR VALUES FROM ('20250930') TO ('20251031');` +
    `CREATE TABLE IF NOT EXISTS ${schemaName}.${tableName}_03 PARTITION OF ${schemaName}.${tableName} FOR VALUES FROM ('20251031') TO ('20251130');` +
    `CREATE TABLE IF NOT EXISTS ${schemaName}.${tableName}_04 PARTITION OF ${schemaName}.${tableName} FOR VALUES FROM ('20251130') TO ('20251231');` +
    `CREATE TABLE IF NOT EXISTS ${schemaName}.${tableName}_05 PARTITION OF ${schemaName}.${tableName} FOR VALUES FROM ('20251231') TO ('20260131');` +
    `CREATE TABLE IF NOT EXISTS ${schemaName}.${tableName}_06 PARTITION OF ${schemaName}.${tableName} FOR VALUES FROM ('20260131') TO ('20260229');` +
    `CREATE TABLE IF NOT EXISTS ${schemaName}.${tableName}_07 PARTITION OF ${schemaName}.${tableName} FOR VALUES FROM ('20260229') TO ('20260331');` +
    `CREATE TABLE IF NOT EXISTS ${schemaName}.${tableName}_08 PARTITION OF ${schemaName}.${tableName} FOR VALUES FROM ('20260331') TO ('20260430');` +
    `CREATE TABLE IF NOT EXISTS ${schemaName}.${tableName}_09 PARTITION OF ${schemaName}.${tableName} FOR VALUES FROM ('20260430') TO ('20260531');` +
    `CREATE TABLE IF NOT EXISTS ${schemaName}.${tableName}_10 PARTITION OF ${schemaName}.${tableName} FOR VALUES FROM ('20260531') TO ('20260630');`
  );
}

export function getListTableNames(schemaName: string): string {
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

export function getCreateViewJobCommand(
  schemaName: string,
  tableName: string
): { cmd: string; viewName: string } {
  const viewName = `${tableName}_view`;
  const cmd = `CREATE or replace VIEW ${schemaName}.${viewName} as
          SELECT a.*
          FROM ${schemaName}.${tableName} a
            join ${schemaName}.${tableJobName} j on
              a.${columnJobIdName} = j.id and 
              a.${columnPatientIdName} = j.${columnPatientIdName}
          WHERE j.id = (
            select max(id) from ${schemaName}.${tableJobName} jj
            where jj.${columnPatientIdName} = a.${columnPatientIdName}
          );`;
  return { cmd, viewName };
}

export function getCreateIndexCommand(schemaName: string, tableName: string): string {
  return (
    `CREATE INDEX IF NOT EXISTS ${tableName}_${indexSuffixName} ` +
    `ON ${schemaName}.${tableName} USING BRIN (${columnJobIdName})`
  );
}
export function getDropIndexCommand(schemaName: string, tableName: string): string {
  return `DROP INDEX IF EXISTS ${schemaName}.${tableName}_${indexSuffixName}`;
}

export function getInsertTableCommand(
  schemaName: string,
  tableName: string,
  columnNames: string[]
): string {
  const valuesPlaceholders = columnNames.map((_, index) => `$${index + 1}`).join(", ");
  const insertQuery = `
    INSERT INTO ${schemaName}.${tableName} (${columnNames.join(", ")})
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
    GRANT ALL ON SCHEMA ${schemaName} TO ${username};
    GRANT ALL ON ALL TABLES IN SCHEMA ${schemaName} TO ${username};
    GRANT ALL ON ALL SEQUENCES IN SCHEMA ${schemaName} TO ${username};
    GRANT ALL ON ALL ROUTINES IN SCHEMA ${schemaName} TO ${username};
    ALTER DEFAULT PRIVILEGES IN SCHEMA ${schemaName} GRANT ALL ON TABLES TO ${username};
    ALTER DEFAULT PRIVILEGES IN SCHEMA ${schemaName} GRANT ALL ON SEQUENCES TO ${username};
    ALTER DEFAULT PRIVILEGES IN SCHEMA ${schemaName} GRANT ALL ON ROUTINES TO ${username};
    `;
  return cmd;
}

export function getGrantFullAccessToAllSchemasCommand({
  dbName,
  username,
}: {
  dbName: string;
  username: string;
}): string {
  const cmd = `GRANT CONNECT ON DATABASE ${dbName} TO ${username};
    GRANT CREATE ON DATABASE ${dbName} TO ${username};
    DO $$
    DECLARE
        schema_name text;
    BEGIN
        FOR schema_name IN 
            SELECT s.schema_name 
            FROM information_schema.schemata s
            WHERE s.schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1')
        LOOP
            EXECUTE format('GRANT ALL ON SCHEMA %I TO %I', schema_name, '${username}');
            EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO %I', schema_name, '${username}');
            EXECUTE format('GRANT ALL ON ALL SEQUENCES IN SCHEMA %I TO %I', schema_name, '${username}');
            EXECUTE format('GRANT ALL ON ALL ROUTINES IN SCHEMA %I TO %I', schema_name, '${username}');
            EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON TABLES TO %I', schema_name, '${username}');
            EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON SEQUENCES TO %I', schema_name, '${username}');
            EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON ROUTINES TO %I', schema_name, '${username}');
        END LOOP;
    END $$;
    `;
  return cmd;
}
