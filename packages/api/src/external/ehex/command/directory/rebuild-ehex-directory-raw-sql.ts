import { QueryTypes, Sequelize } from "sequelize";
import { executeOnDBTx } from "../../../../models/transaction-wrapper";
import { EhexDirectoryEntry, EhexDirectoryEntryData } from "../../ehex-directory";
import { EhexDirectoryEntryViewModel } from "../../models/ehex-directory-view";
import {
  addressLineColumnName,
  urlDqColumnName,
  urlDrColumnName,
  urlXcpdColumnName,
  lastUpdatedAtEhexColumnName,
  managingOrgIdColumnName,
  rootOrgColumnName,
} from "../../models/ehex-directory-columns";

export const ehexDirectoryEntry = `ehex_directory_entry_new`;
export const ehexDirectoryEntryView = `ehex_directory_entry_view`;
export const ehexDirectoryEntryTemp = `ehex_directory_entry_temp`;
export const ehexDirectoryEntryBackup1 = `ehex_directory_entry_backup1`;
export const ehexDirectoryEntryBackup2 = `ehex_directory_entry_backup2`;
export const ehexDirectoryEntryBackup3 = `ehex_directory_entry_backup3`;

const pkNamePrefix = "ehex_directory_entry_pkey";
const indexNamePrefix = "ehex_directory_entry_new_managing_organization_id_idx";
const idIndexNamePrefix = "ehex_directory_entry_new_id_idx";

const keys = createKeys();
const number_of_keys = keys.split(",").length;

export async function insertEhexDirectoryEntries(
  sequelize: Sequelize,
  orgDataArray: EhexDirectoryEntryData[]
): Promise<void> {
  if (orgDataArray.length === 0) return;
  const placeholders = orgDataArray
    .map(() => `(${new Array(number_of_keys).fill("?").join(", ")})`)
    .join(", ");

  const flattenedData = orgDataArray.flatMap(entry => [
    entry.id,
    entry.name,
    entry.urlXcpd ?? null,
    entry.urlDq ?? null,
    entry.urlDr ?? null,
    entry.lat ?? null,
    entry.lon ?? null,
    entry.point ?? null,
    entry.addressLine ?? null,
    entry.city ?? null,
    entry.state ?? null,
    entry.zip ?? null,
    entry.data ? JSON.stringify(entry.data) : null,
    entry.rootOrganization ?? null,
    entry.managingOrganizationId ?? null,
    entry.active,
    entry.lastUpdatedAtEhex,
  ]);

  const query = `INSERT INTO ${ehexDirectoryEntryTemp} (${keys}) VALUES ${placeholders};`;
  await sequelize.query(query, {
    replacements: flattenedData,
    type: QueryTypes.INSERT,
    logging: false,
  });
}

function createKeys(): string {
  // The order matters, it's tied to the insert below
  const allKeys: Record<
    keyof Omit<EhexDirectoryEntry, "delegateOids" | "eTag" | "createdAt" | "updatedAt">,
    string
  > = {
    id: "id",
    name: "name",
    urlXcpd: urlXcpdColumnName,
    urlDq: urlDqColumnName,
    urlDr: urlDrColumnName,
    lat: "lat",
    lon: "lon",
    point: "point",
    addressLine: addressLineColumnName,
    city: "city",
    state: "state",
    zip: "zip",
    data: "data",
    rootOrganization: rootOrgColumnName,
    managingOrganizationId: managingOrgIdColumnName,
    active: "active",
    lastUpdatedAtEhex: lastUpdatedAtEhexColumnName,
  };

  return Object.values(allKeys).join(", ");
}

export async function getEhexDirectoryIds(sequelize: Sequelize): Promise<string[]> {
  const query = `SELECT id FROM ${ehexDirectoryEntryTemp};`;
  const result = await sequelize.query<{ id: string }>(query, { type: QueryTypes.SELECT });
  return result.map(row => row.id);
}

export async function deleteEhexDirectoryEntries(
  sequelize: Sequelize,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => "?").join(", ");
  const query = `DELETE FROM ${ehexDirectoryEntryTemp} WHERE id IN (${placeholders});`;
  await sequelize.query(query, { replacements: ids, type: QueryTypes.DELETE });
}

export async function createTempEhexDirectoryTable(sequelize: Sequelize): Promise<void> {
  await deleteTempEhexDirectoryTable(sequelize);
  // The PK is added later, on `updateEhexDirectoryViewDefinition`
  const query = `CREATE TABLE IF NOT EXISTS ${ehexDirectoryEntryTemp} (LIKE ${ehexDirectoryEntry} 
                 INCLUDING DEFAULTS INCLUDING STORAGE INCLUDING GENERATED EXCLUDING CONSTRAINTS)`;
  await sequelize.query(query, { type: QueryTypes.RAW });
}

export async function deleteTempEhexDirectoryTable(sequelize: Sequelize): Promise<void> {
  const query = `DROP TABLE IF EXISTS ${ehexDirectoryEntryTemp}`;
  await sequelize.query(query, { type: QueryTypes.RAW });
}

export async function updateEhexDirectoryViewDefinition(sequelize: Sequelize): Promise<void> {
  await executeOnDBTx(EhexDirectoryEntryViewModel.prototype, async transaction => {
    async function runSql(sql: string): Promise<void> {
      await sequelize.query(sql, { type: QueryTypes.RAW, transaction });
    }
    const timestamp = new Date().getTime();
    await runSql(
      `ALTER TABLE ${ehexDirectoryEntryTemp} ADD CONSTRAINT ${addTimestampSuffix(
        pkNamePrefix,
        timestamp
      )} PRIMARY KEY (id);`
    );
    await runSql(
      `CREATE INDEX ${addTimestampSuffix(
        indexNamePrefix,
        timestamp
      )} ON ${ehexDirectoryEntryTemp} (managing_organization_id);`
    );
    await runSql(
      `CREATE INDEX ${addTimestampSuffix(
        idIndexNamePrefix,
        timestamp
      )} ON ${ehexDirectoryEntryTemp} (id);`
    );
    await runSql(
      `CREATE OR REPLACE VIEW ${ehexDirectoryEntryView} AS SELECT * FROM ${ehexDirectoryEntryTemp};`
    );
    await runSql(`DROP TABLE IF EXISTS ${ehexDirectoryEntryBackup3};`);
    await runSql(
      `ALTER TABLE IF EXISTS ${ehexDirectoryEntryBackup2} RENAME TO ${ehexDirectoryEntryBackup3};`
    );
    await runSql(
      `ALTER TABLE IF EXISTS ${ehexDirectoryEntryBackup1} RENAME TO ${ehexDirectoryEntryBackup2};`
    );
    await runSql(`ALTER TABLE ${ehexDirectoryEntry} RENAME TO ${ehexDirectoryEntryBackup1};`);
    await runSql(`ALTER TABLE ${ehexDirectoryEntryTemp} RENAME TO ${ehexDirectoryEntry};`);
  });
}

function addTimestampSuffix(name: string, timestamp: number): string {
  return `${name}_${timestamp}`;
}
