import { QueryTypes } from "sequelize";
import { Pagination, sortForPagination } from "../../../command/pagination";
import { paginationSqlExpressions } from "../../../shared/sql";
import { HieDirectoryEntry } from "../domain/hie-directory-entry";
import { HIEDirectoryEntryViewModel } from "../models/hie-directory-view";

const defaultPageSize = 100;

export async function getHieDirectoryEntriesByFilter({
  filter,
  pagination,
}: {
  filter: string | undefined;
  pagination: Pagination;
}): Promise<HieDirectoryEntry[]> {
  const sequelize = HIEDirectoryEntryViewModel.sequelize;
  if (!sequelize) throw new Error("Sequelize not found");

  const querySelect = `SELECT * FROM ${HIEDirectoryEntryViewModel.NAME} WHERE 1 = 1 `;

  const queryFTS =
    querySelect +
    (filter ? ` AND (search_criteria @@ websearch_to_tsquery('english', :filter))` : "");

  const queryFinal = queryFTS + paginationSqlExpressions(pagination, "oid");

  const { toItem, fromItem, count } = pagination ?? {};
  const cqDirectoryEntries = await sequelize.query(queryFinal, {
    model: HIEDirectoryEntryViewModel,
    mapToModel: true,
    replacements: {
      ...(toItem ? { toItem } : {}),
      ...(fromItem ? { fromItem } : {}),
      ...(count ? { count } : { count: defaultPageSize }),
      ...(filter ? { filter } : {}),
    },
    type: QueryTypes.SELECT,
  });

  const sortedCqDirectoryEntries = sortForPagination(cqDirectoryEntries, pagination);
  return sortedCqDirectoryEntries.map(entry => entry.dataValues);
}

export async function getHieDirectoryEntriesByFilterCount({
  filter,
}: {
  filter: string | undefined;
}): Promise<number> {
  const sequelize = HIEDirectoryEntryViewModel.sequelize;
  if (!sequelize) throw new Error("Sequelize not found");

  const querySelect = `SELECT COUNT(*) FROM ${HIEDirectoryEntryViewModel.NAME} WHERE 1 = 1`;

  const queryFTS =
    querySelect +
    (filter ? ` AND (search_criteria @@ websearch_to_tsquery('english', :filter))` : "");

  const result = await sequelize.query(queryFTS, {
    type: QueryTypes.SELECT,
    replacements: {
      ...(filter ? { filter } : {}),
    },
  });

  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  return parseInt((result[0] as unknown as any).count);
}
