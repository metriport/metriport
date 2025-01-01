import { QueryTypes, Sequelize } from "sequelize";
import { CQDirectoryEntryData } from "../../cq-directory";
import { CQDirectoryEntryModel } from "../../models/cq-directory";

const keys = createKeys();
const number_of_keys = keys.split(",").length;

function createKeys(): string {
  const id: keyof Pick<CQDirectoryEntryModel, "id"> = "id";
  const name: keyof Pick<CQDirectoryEntryModel, "name"> = "name";
  const urlXCPD: keyof Pick<CQDirectoryEntryModel, "urlXCPD"> = "urlXCPD";
  const urlDQ: keyof Pick<CQDirectoryEntryModel, "urlDQ"> = "urlDQ";
  const urlDR: keyof Pick<CQDirectoryEntryModel, "urlDR"> = "urlDR";
  const lat: keyof Pick<CQDirectoryEntryModel, "lat"> = "lat";
  const lon: keyof Pick<CQDirectoryEntryModel, "lon"> = "lon";
  const point: keyof Pick<CQDirectoryEntryModel, "point"> = "point";
  const addressLine: keyof Pick<CQDirectoryEntryModel, "addressLine"> = "addressLine";
  const city: keyof Pick<CQDirectoryEntryModel, "city"> = "city";
  const state: keyof Pick<CQDirectoryEntryModel, "state"> = "state";
  const zip: keyof Pick<CQDirectoryEntryModel, "zip"> = "zip";
  const data: keyof Pick<CQDirectoryEntryModel, "data"> = "data";
  const createdAt: keyof Pick<CQDirectoryEntryModel, "createdAt"> = "createdAt";
  const managingOrganization: keyof Pick<CQDirectoryEntryModel, "managingOrganization"> =
    "managingOrganization";
  const managingOrganizationId: keyof Pick<CQDirectoryEntryModel, "managingOrganizationId"> =
    "managingOrganizationId";
  const active: keyof Pick<CQDirectoryEntryModel, "active"> = "active";
  const lastUpdatedAtCQ: keyof Pick<CQDirectoryEntryModel, "lastUpdatedAtCQ"> = "lastUpdatedAtCQ";

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
  orgDataArray: CQDirectoryEntryData[],
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
