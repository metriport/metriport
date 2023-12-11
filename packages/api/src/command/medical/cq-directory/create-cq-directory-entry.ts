import { QueryTypes, Sequelize } from "sequelize";
import { CQDirectoryEntryData } from "../../../domain/medical/cq-directory";
import { CQDirectoryEntryModel } from "../../../models/medical/cq-directory";
import { cqDirectoryEntryTemp } from "./shared";

const keys = createKeys();

function createKeys(): string {
  const id: keyof Pick<CQDirectoryEntryModel, "id"> = "id";
  const name: keyof Pick<CQDirectoryEntryModel, "name"> = "name";
  const urlXCPD: keyof Pick<CQDirectoryEntryModel, "urlXCPD"> = "urlXCPD";
  const urlDQ: keyof Pick<CQDirectoryEntryModel, "urlDQ"> = "urlDQ";
  const urlDR: keyof Pick<CQDirectoryEntryModel, "urlDR"> = "urlDR";
  const lat: keyof Pick<CQDirectoryEntryModel, "lat"> = "lat";
  const lon: keyof Pick<CQDirectoryEntryModel, "lon"> = "lon";
  const point: keyof Pick<CQDirectoryEntryModel, "point"> = "point";
  const state: keyof Pick<CQDirectoryEntryModel, "state"> = "state";
  const data: keyof Pick<CQDirectoryEntryModel, "data"> = "data";
  const createdAt: keyof Pick<CQDirectoryEntryModel, "createdAt"> = "createdAt";
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
    state,
    data,
    createdAt ? "created_at" : undefined,
    lastUpdatedAtCQ ? "last_updated_at_cq" : undefined,
  ];

  return allKeys.join(", ");
}

export async function bulkInsertCQDirectoryEntries(
  sequelize: Sequelize,
  orgDataArray: CQDirectoryEntryData[]
): Promise<void> {
  if (orgDataArray.length === 0) return;
  const placeholders = orgDataArray.map(() => `(${new Array(12).fill("?").join(", ")})`).join(", ");
  const date = new Date().toISOString();

  const flattenedData = orgDataArray.flatMap(entry => [
    entry.id,
    entry.name,
    entry.urlXCPD,
    entry.urlDQ ?? null,
    entry.urlDR ?? null,
    entry.lat ?? null,
    entry.lon ?? null,
    entry.point ?? null,
    entry.state ?? null,
    entry.data ? JSON.stringify(entry.data) : null,
    date,
    entry.lastUpdatedAtCQ ?? null,
  ]);

  const query = `INSERT INTO ${cqDirectoryEntryTemp} (${keys}) VALUES ${placeholders};`;
  await sequelize.query(query, {
    replacements: flattenedData,
    type: QueryTypes.INSERT,
    logging: false,
  });
}
