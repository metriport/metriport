export function getCxDbName(cxId: string, dbname: string): string {
  return `${dbname}_${cxId}`;
}

export const tableJobName = "metriport_incremental_job";

export const columnPatientIdName = "m_patient_id";
export const columnJobIdName = "m_job_id";

const defaultColumnType = "VARCHAR";

export const columnPatientIdDefinition = `${columnPatientIdName} ${defaultColumnType}`;
export const columnJobIdDefinition = `${columnJobIdName} ${defaultColumnType}`;

export const additionalColumnDefs = `${columnPatientIdDefinition}, ${columnJobIdDefinition}`;

export const createTableJobCommand =
  `CREATE TABLE IF NOT EXISTS ${tableJobName} (` +
  `id VARCHAR PRIMARY KEY, ${columnPatientIdDefinition})`;

export const insertTableJobCommand = `INSERT INTO ${tableJobName} (id, ${columnPatientIdName}) VALUES ($1, $2)`;

export function getCreateTableCommand(tableName: string, columnsDef: string): string {
  return `CREATE TABLE IF NOT EXISTS ${tableName} (${columnsDef})`;
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
  return `CREATE INDEX IF NOT EXISTS ${tableName}_index ON ${tableName} (${columnJobIdName}, ${columnPatientIdName})`;
}
export function getDropIndexCommand(tableName: string): string {
  return `DROP INDEX IF EXISTS ${tableName}_index`;
}

export function getInsertTableCommand(tableName: string, columnNames: string[]): string {
  const valuesPlaceholders = columnNames.map((_, index) => `$${index + 1}`).join(", ");
  const insertQuery = `
    INSERT INTO ${tableName} (${columnNames.join(", ")})
    VALUES (${valuesPlaceholders})
  `;
  return insertQuery;
}
