import { QueryTypes, Sequelize } from "sequelize";
import { CQDirectoryEntry, CQDirectoryEntryData2 } from "../../cq-directory";
import {
  addressLineColumnName,
  lastUpdatedAtCqColumnName,
  managingOrgIdColumnName,
  urlDqColumnName,
  urlDrColumnName,
  urlXcpdColumnName,
} from "../../models/cq-directory";
import { rootOrgColumnName } from "../../models/cq-directory-view";

const keys = createKeys();
const number_of_keys = keys.split(",").length;

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

export async function bulkInsertCQDirectoryEntries(
  sequelize: Sequelize,
  orgDataArray: CQDirectoryEntryData2[],
  tableName: string
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
    entry.active ?? false,
    entry.lastUpdatedAtCQ ?? null,
  ]);

  const query = `INSERT INTO ${tableName} (${keys}) VALUES ${placeholders};`;
  await sequelize.query(query, {
    replacements: flattenedData,
    type: QueryTypes.INSERT,
    logging: false,
  });
}
