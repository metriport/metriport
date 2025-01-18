import { QueryTypes } from "sequelize";
import { Pagination, sortForPagination } from "../../../../command/pagination";
import { CQDirectoryEntry2 } from "../../cq-directory";
import { CQDirectoryEntryViewModel } from "../../models/cq-directory-view";

export async function getCQDirectoryEntriesByFilter(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  { filter, pagination }: { filter: string; pagination: Pagination }
): Promise<CQDirectoryEntry2[]> {
  const sequelize = CQDirectoryEntryViewModel.sequelize;
  if (!sequelize) throw new Error("Sequelize not found");

  const querySelect = `SELECT * FROM ${CQDirectoryEntryViewModel.tableName} WHERE 1 = 1 `;

  const { toItem, fromItem } = pagination ?? {};
  const toItemStr = toItem ? ` AND id >= :toItem` : "";
  const fromItemStr = fromItem ? ` AND id <= :fromItem` : "";
  const queryPagination = querySelect + " " + [toItemStr, fromItemStr].filter(Boolean).join("");

  const queryOrder = queryPagination + " ORDER BY id " + (toItem ? "ASC" : "DESC");

  const { count } = pagination ?? {};
  const queryLimits = queryOrder + (count ? ` LIMIT :count` : "");

  const queryFinal = queryLimits;
  const cqDirectoryEntries = await sequelize.query(queryFinal, {
    model: CQDirectoryEntryViewModel,
    mapToModel: true,
    replacements: {
      ...(toItem ? { toItem } : {}),
      ...(fromItem ? { fromItem } : {}),
      ...(count ? { count } : {}),
    },
    type: QueryTypes.SELECT,
  });

  const sortedCqDirectoryEntries = sortForPagination(cqDirectoryEntries, pagination);
  return sortedCqDirectoryEntries.map(entry => entry.dataValues);
}

export async function getCQDirectoryEntriesByFilterCount(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  { filter }: { filter: string }
): Promise<number> {
  const sequelize = CQDirectoryEntryViewModel.sequelize;
  if (!sequelize) throw new Error("Sequelize not found");

  const querySelect = `SELECT COUNT(*) FROM ${CQDirectoryEntryViewModel.tableName} `;

  const result = await sequelize.query(querySelect, {
    type: QueryTypes.SELECT,
  });

  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  return parseInt((result[0] as unknown as any).count);
}
