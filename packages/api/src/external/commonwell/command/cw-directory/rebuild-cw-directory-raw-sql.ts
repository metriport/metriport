import { QueryTypes, Sequelize } from "sequelize";
import { executeOnDBTx } from "../../../../models/transaction-wrapper";
import { CwDirectoryEntryViewModel } from "../../../commonwell/models/cw-directory-view";
import { CwDirectoryEntryData } from "../../cw-directory";

export const cwDirectoryEntry = `cw_directory_entry_new`;
export const cwDirectoryEntryView = `cw_directory_entry_view`;
export const cwDirectoryEntryTemp = `cw_directory_entry_temp`;
export const cwDirectoryEntryBackup1 = `cw_directory_entry_backup1`;
export const cwDirectoryEntryBackup2 = `cw_directory_entry_backup2`;
export const cwDirectoryEntryBackup3 = `cw_directory_entry_backup3`;

const pkNamePrefix = "cw_directory_entry_pkey";
const indexNamePrefix = "cw_directory_entry_new_organization_id_idx";

const keys = createKeys();
const number_of_keys = keys.split(",").length;

export async function insertCwDirectoryEntries(
  sequelize: Sequelize,
  orgDataArray: CwDirectoryEntryData[]
): Promise<void> {
  if (orgDataArray.length === 0) return;
  const placeholders = orgDataArray
    .map(() => `(${new Array(number_of_keys).fill("?").join(", ")})`)
    .join(", ");

  const flattenedData = orgDataArray.flatMap(entry => [
    entry.name,
    entry.oid,
    entry.orgType,
    entry.rootOrganization,
    entry.addressLine,
    entry.city ?? null,
    entry.state ?? null,
    entry.zip ?? null,
    entry.data ? JSON.stringify(entry.data) : null,
    entry.active,
    entry.npi ?? null,
  ]);

  const query = `INSERT INTO ${cwDirectoryEntryTemp} (${keys}) VALUES ${placeholders};`;
  await sequelize.query(query, {
    replacements: flattenedData,
    type: QueryTypes.INSERT,
    logging: false,
  });
}

function createKeys(): string {
  // The order matters, it's tied to the insert below
  const allKeys: Record<
    keyof Omit<CwDirectoryEntryData, "id" | "createdAt" | "updatedAt" | "delegateOids">,
    string
  > = {
    name: "name",
    oid: "oid",
    orgType: "org_type",
    rootOrganization: "root_organization",
    addressLine: "address_line",
    city: "city",
    state: "state",
    zip: "zip",
    data: "data",
    active: "active",
    npi: "npi",
  };

  return Object.values(allKeys).join(", ");
}

export async function getCwDirectoryIds(sequelize: Sequelize): Promise<string[]> {
  const query = `SELECT oid FROM ${cwDirectoryEntryTemp};`;
  const result = await sequelize.query<{ oid: string }>(query, { type: QueryTypes.SELECT });
  return result.map(row => row.oid);
}

export async function createTempCwDirectoryTable(sequelize: Sequelize): Promise<void> {
  await deleteTempCwDirectoryTable(sequelize);
  // The PK is added later, on `updateCwDirectoryViewDefinition`
  const query = `CREATE TABLE IF NOT EXISTS ${cwDirectoryEntryTemp}
   (LIKE ${cwDirectoryEntry}
    INCLUDING DEFAULTS INCLUDING STORAGE INCLUDING GENERATED EXCLUDING CONSTRAINTS)`;
  await sequelize.query(query, { type: QueryTypes.RAW });
}

export async function deleteTempCwDirectoryTable(sequelize: Sequelize): Promise<void> {
  const query = `DROP TABLE IF EXISTS ${cwDirectoryEntryTemp}`;
  await sequelize.query(query, { type: QueryTypes.RAW });
}

export async function updateCwDirectoryViewDefinition(sequelize: Sequelize): Promise<void> {
  await executeOnDBTx(CwDirectoryEntryViewModel.prototype, async transaction => {
    async function runSql(sql: string): Promise<void> {
      await sequelize.query(sql, { type: QueryTypes.RAW, transaction });
    }
    const timestamp = new Date().getTime();
    await runSql(
      `ALTER TABLE ${cwDirectoryEntryTemp} ADD CONSTRAINT ${addTimestampSuffix(
        pkNamePrefix,
        timestamp
      )} PRIMARY KEY (id);`
    );
    await runSql(
      `CREATE INDEX ${addTimestampSuffix(
        indexNamePrefix,
        timestamp
      )} ON ${cwDirectoryEntryTemp} (oid);`
    );
    await runSql(
      `CREATE OR REPLACE VIEW ${cwDirectoryEntryView} AS SELECT * FROM ${cwDirectoryEntryTemp};`
    );
    await runSql(`DROP TABLE IF EXISTS ${cwDirectoryEntryBackup3};`);
    await runSql(
      `ALTER TABLE IF EXISTS ${cwDirectoryEntryBackup2} RENAME TO ${cwDirectoryEntryBackup3};`
    );
    await runSql(
      `ALTER TABLE IF EXISTS ${cwDirectoryEntryBackup1} RENAME TO ${cwDirectoryEntryBackup2};`
    );
    await runSql(`ALTER TABLE ${cwDirectoryEntry} RENAME TO ${cwDirectoryEntryBackup1};`);
    await runSql(`ALTER TABLE ${cwDirectoryEntryTemp} RENAME TO ${cwDirectoryEntry};`);
  });
}

function addTimestampSuffix(name: string, timestamp: number): string {
  return `${name}_${timestamp}`;
}
