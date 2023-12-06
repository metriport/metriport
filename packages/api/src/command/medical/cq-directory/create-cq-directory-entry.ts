import { QueryTypes, Sequelize } from "sequelize";
import { CQDirectoryEntryData } from "../../../domain/medical/cq-directory";

export const bulkInsertCQDirectoryEntries = async (
  sequelize: Sequelize,
  orgDataArray: CQDirectoryEntryData[]
) => {
  if (orgDataArray.length === 0) return;

  const keys = `id, name, url_xcpd, url_dq, url_dr, lat, lon, point, state, data, created_at, last_updated`;
  const placeholders = orgDataArray.map(() => `(${new Array(12).fill("?").join(", ")})`).join(", ");

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
    new Date().toISOString(),
    entry.lastUpdated ?? null,
  ]);

  const query = `INSERT INTO cq_directory_entry_temp (${keys}) VALUES ${placeholders};`;
  await sequelize.query(query, {
    replacements: flattenedData,
    type: QueryTypes.INSERT,
    logging: false,
  });
};
