export const tableJobName = "metriport_incremental_job";

export const columnCxIdName = "m_cx_id";
export const columnPatientIdName = "m_patient_id";
export const columnJobIdName = "m_job_id";

const defaultColumnType = "VARCHAR";

export const columnCxIdDefinition = `${columnCxIdName} ${defaultColumnType}`;
export const columnPatientIdDefinition = `${columnPatientIdName} ${defaultColumnType}`;
export const columnJobIdDefinition = `${columnJobIdName} ${defaultColumnType}`;

export const additionalColumnDefs = `${columnCxIdDefinition}, ${columnPatientIdDefinition}, ${columnJobIdDefinition}`;

export const createTableJobCommand =
  `CREATE TABLE IF NOT EXISTS ${tableJobName} (` +
  `id VARCHAR PRIMARY KEY, ${columnCxIdDefinition}, ${columnPatientIdDefinition})`;

export const insertTableJobCommand =
  `INSERT INTO ${tableJobName} (` +
  `id, ${columnCxIdName}, ${columnPatientIdName}) ` +
  `VALUES ($1, $2, $3)`;

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
              a.${columnCxIdName} = j.${columnCxIdName} and
              a.${columnPatientIdName} = j.${columnPatientIdName}
          WHERE j.id = (select max(id) from ${tableJobName});`;
  return { cmd, viewName };
}

export function getInsertTableCommand(tableName: string, columnNames: string[]): string {
  const valuesPlaceholders = columnNames.map((_, index) => `$${index + 1}`).join(", ");
  const insertQuery = `
    INSERT INTO ${tableName} (${columnNames.join(", ")})
    VALUES (${valuesPlaceholders})
  `;
  return insertQuery;
}
