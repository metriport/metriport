import { QueryTypes, Sequelize } from "sequelize";
import { executeOnDBTx } from "../../../../models/transaction-wrapper";
import { CQDirectoryEntry, CQDirectoryEntryData2 } from "../../cq-directory";
import {
  addressLineColumnName,
  lastUpdatedAtCqColumnName,
  managingOrgIdColumnName,
  urlDqColumnName,
  urlDrColumnName,
  urlXcpdColumnName,
} from "../../models/cq-directory";
import { CQDirectoryEntryViewModel, rootOrgColumnName } from "../../models/cq-directory-view";

// TODO 2553 To be updated to `cq_directory_entry` on a follow-up PR
export const cqDirectoryEntry = `cq_directory_entry_new`;
export const cqDirectoryEntryView = `cq_directory_entry_view`;
export const cqDirectoryEntryTemp = `cq_directory_entry_temp`;
export const cqDirectoryEntryBackup1 = `cq_directory_entry_backup1`;
export const cqDirectoryEntryBackup2 = `cq_directory_entry_backup2`;
export const cqDirectoryEntryBackup3 = `cq_directory_entry_backup3`;

const pkNamePrefix = "cq_directory_entry_pkey";

const keys = createKeys();
const number_of_keys = keys.split(",").length;

export async function insertCqDirectoryEntries(
  sequelize: Sequelize,
  orgDataArray: CQDirectoryEntryData2[]
): Promise<void> {
  if (orgDataArray.length === 0) return;
  const placeholders = orgDataArray
    .map(() => `(${new Array(number_of_keys).fill("?").join(", ")})`)
    .join(", ");

  const flattenedData = orgDataArray.flatMap(entry => [
    entry.id,
    entry.name,
    entry.urlXCPD ?? null,
    entry.urlDQ ?? null,
    entry.urlDR ?? null,
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
    entry.lastUpdatedAtCQ,
  ]);

  const query = `INSERT INTO ${cqDirectoryEntryTemp} (${keys}) VALUES ${placeholders};`;
  await sequelize.query(query, {
    replacements: flattenedData,
    type: QueryTypes.INSERT,
    logging: false,
  });
}

function createKeys(): string {
  // The order matters, it's tied to the insert below
  const allKeys: Record<keyof Omit<CQDirectoryEntry, "eTag" | "createdAt" | "updatedAt">, string> =
    {
      id: "id",
      name: "name",
      urlXCPD: urlXcpdColumnName,
      urlDQ: urlDqColumnName,
      urlDR: urlDrColumnName,
      lat: "lat",
      lon: "lon",
      point: "point",
      addressLine: addressLineColumnName,
      city: "city",
      state: "state",
      zip: "zip",
      data: "data",
      // TODO 2553 Import this from the `cq-directory` file
      rootOrganization: rootOrgColumnName,
      managingOrganizationId: managingOrgIdColumnName,
      active: "active",
      lastUpdatedAtCQ: lastUpdatedAtCqColumnName,
    };

  return Object.values(allKeys).join(", ");
}

export async function getCqDirectoryIds(sequelize: Sequelize): Promise<string[]> {
  const query = `SELECT id FROM ${cqDirectoryEntryTemp};`;
  const result = await sequelize.query<{ id: string }>(query, { type: QueryTypes.SELECT });
  return result.map(row => row.id);
}

export async function deleteCqDirectoryEntries(sequelize: Sequelize, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const query = `DELETE FROM ${cqDirectoryEntryTemp} WHERE id in ('${ids.join(`','`)}');`;
  await sequelize.query(query, { type: QueryTypes.DELETE });
}

export async function createTempCqDirectoryTable(sequelize: Sequelize): Promise<void> {
  await deleteTempCqDirectoryTable(sequelize);
  // The PK is added later, on `updateCqDirectoryViewDefinition`
  const query = `CREATE TABLE IF NOT EXISTS ${cqDirectoryEntryTemp} (LIKE ${cqDirectoryEntry} 
                 INCLUDING DEFAULTS INCLUDING STORAGE INCLUDING GENERATED EXCLUDING CONSTRAINTS)`;
  await sequelize.query(query, { type: QueryTypes.RAW });
}

export async function deleteTempCqDirectoryTable(sequelize: Sequelize): Promise<void> {
  const query = `DROP TABLE IF EXISTS ${cqDirectoryEntryTemp}`;
  await sequelize.query(query, { type: QueryTypes.RAW });
}

export async function updateCqDirectoryViewDefinition(sequelize: Sequelize): Promise<void> {
  await executeOnDBTx(CQDirectoryEntryViewModel.prototype, async transaction => {
    async function runSql(sql: string): Promise<void> {
      await sequelize.query(sql, { type: QueryTypes.RAW, transaction });
    }
    await runSql(
      `ALTER TABLE ${cqDirectoryEntryTemp} ADD CONSTRAINT ${buildPkName()} PRIMARY KEY (id);`
    );
    await runSql(
      `CREATE OR REPLACE VIEW ${cqDirectoryEntryView} AS SELECT * FROM ${cqDirectoryEntryTemp};`
    );
    await runSql(`DROP TABLE IF EXISTS ${cqDirectoryEntryBackup3};`);
    await runSql(
      `ALTER TABLE IF EXISTS ${cqDirectoryEntryBackup2} RENAME TO ${cqDirectoryEntryBackup3};`
    );
    await runSql(
      `ALTER TABLE IF EXISTS ${cqDirectoryEntryBackup1} RENAME TO ${cqDirectoryEntryBackup2};`
    );
    await runSql(`ALTER TABLE ${cqDirectoryEntry} RENAME TO ${cqDirectoryEntryBackup1};`);
    await runSql(`ALTER TABLE ${cqDirectoryEntryTemp} RENAME TO ${cqDirectoryEntry};`);
  });
}

function buildPkName(): string {
  const timestamp = new Date().getTime();
  return `${pkNamePrefix}_${timestamp}`;
}
