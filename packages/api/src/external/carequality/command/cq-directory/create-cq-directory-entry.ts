import { QueryTypes, Sequelize } from "sequelize";
import { CQDirectoryEntryData2 } from "../../cq-directory";
import { CQDirectoryEntryViewModel } from "../../models/cq-directory-view";

const keys = createKeys();
const number_of_keys = keys.split(",").length;

function createKeys(): string {
  const id: keyof Pick<CQDirectoryEntryViewModel, "id"> = "id";
  const name: keyof Pick<CQDirectoryEntryViewModel, "name"> = "name";
  const urlXCPD: keyof Pick<CQDirectoryEntryViewModel, "urlXCPD"> = "urlXCPD";
  const urlDQ: keyof Pick<CQDirectoryEntryViewModel, "urlDQ"> = "urlDQ";
  const urlDR: keyof Pick<CQDirectoryEntryViewModel, "urlDR"> = "urlDR";
  const lat: keyof Pick<CQDirectoryEntryViewModel, "lat"> = "lat";
  const lon: keyof Pick<CQDirectoryEntryViewModel, "lon"> = "lon";
  const point: keyof Pick<CQDirectoryEntryViewModel, "point"> = "point";
  const addressLine: keyof Pick<CQDirectoryEntryViewModel, "addressLine"> = "addressLine";
  const city: keyof Pick<CQDirectoryEntryViewModel, "city"> = "city";
  const state: keyof Pick<CQDirectoryEntryViewModel, "state"> = "state";
  const zip: keyof Pick<CQDirectoryEntryViewModel, "zip"> = "zip";
  const data: keyof Pick<CQDirectoryEntryViewModel, "data"> = "data";
  const createdAt: keyof Pick<CQDirectoryEntryViewModel, "createdAt"> = "createdAt";
  const managingOrganization: keyof Pick<CQDirectoryEntryViewModel, "managingOrganization"> =
    "managingOrganization";
  const managingOrganizationId: keyof Pick<CQDirectoryEntryViewModel, "managingOrganizationId"> =
    "managingOrganizationId";
  const active: keyof Pick<CQDirectoryEntryViewModel, "active"> = "active";
  const lastUpdatedAtCQ: keyof Pick<CQDirectoryEntryViewModel, "lastUpdatedAtCQ"> =
    "lastUpdatedAtCQ";

  const allKeys = [
    id,
    name,
    urlXCPD ? "url_xcpd" : undefined,
    urlDQ ? "url_dq" : undefined,
    urlDR ? "url_dr" : undefined,
    lat,
    lon,
    point,
    addressLine ? "address_line" : undefined,
    city,
    state,
    zip,
    data,
    createdAt ? "created_at" : undefined,
    managingOrganization ? "managing_organization" : undefined,
    managingOrganizationId ? "managing_organization_id" : undefined,
    active ? "active" : undefined,
    lastUpdatedAtCQ ? "last_updated_at_cq" : undefined,
  ];

  return allKeys.join(", ");
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
  const date = new Date().toISOString();

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
    date,
    entry.managingOrganization ?? null,
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
