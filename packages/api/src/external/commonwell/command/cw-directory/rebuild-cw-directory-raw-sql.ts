import { QueryTypes, Sequelize } from "sequelize";
import { executeOnDBTx } from "../../../../models/transaction-wrapper";
import { CwDirectoryEntry, CwDirectoryEntryData } from "../../cw-directory";
import { CwDirectoryEntryViewModel } from "../../../commonwell/models/cw-directory-view";

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
    entry.id,
    entry.organizationName,
    entry.organizationId,
    entry.orgType,
    entry.memberName,
    entry.addressLine1,
    entry.addressLine2 ?? null,
    entry.city,
    entry.state,
    entry.zipCode,
    entry.country,
    entry.networks ? JSON.stringify(entry.networks) : null,
    entry.active,
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
    keyof Omit<CwDirectoryEntry, "createdAt" | "updatedAt" | "delegateOids">,
    string
  > = {
    id: "id",
    organizationName: "organization_name",
    organizationId: "organization_id",
    orgType: "org_type",
    memberName: "member_name",
    addressLine1: "address_line1",
    addressLine2: "address_line2",
    city: "city",
    state: "state",
    zipCode: "zip_code",
    country: "country",
    networks: "networks",
    active: "active",
  };

  return Object.values(allKeys).join(", ");
}

export async function getCwDirectoryIds(sequelize: Sequelize): Promise<string[]> {
  const query = `SELECT id FROM ${cwDirectoryEntryTemp};`;
  const result = await sequelize.query<{ id: string }>(query, { type: QueryTypes.SELECT });
  return result.map(row => row.id);
}

export async function deleteCwDirectoryEntries(sequelize: Sequelize, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const query = `DELETE FROM ${cwDirectoryEntryTemp} WHERE id in ('${ids.join(`','`)}');`;
  await sequelize.query(query, { type: QueryTypes.DELETE });
}

export async function createTempCwDirectoryTable(sequelize: Sequelize): Promise<void> {
  await deleteTempCwDirectoryTable(sequelize);
  // The PK is added later, on `updateCwDirectoryViewDefinition`
  const query = `CREATE TABLE IF NOT EXISTS ${cwDirectoryEntryTemp} (LIKE ${cwDirectoryEntry} 
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
      )} ON ${cwDirectoryEntryTemp} (organization_id);`
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
