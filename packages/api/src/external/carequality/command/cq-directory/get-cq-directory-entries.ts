import { QueryTypes } from "sequelize";
import { Pagination, sortForPagination } from "../../../../command/pagination";
import { CQDirectoryEntry2 } from "../../cq-directory";
import { HIEDirectoryEntryViewModel } from "../../models/hie-directory-view";
import { paginationSqlExpressions } from "../../../../shared/sql";

export async function getHieDirectoryEntriesByFilter({
  filter,
  pagination,
}: {
  filter: string | undefined;
  pagination: Pagination;
}): Promise<CQDirectoryEntry2[]> {
  const sequelize = HIEDirectoryEntryViewModel.sequelize;
  if (!sequelize) throw new Error("Sequelize not found");

  const querySelect = `SELECT * FROM ${HIEDirectoryEntryViewModel.NAME} WHERE 1 = 1 `;

  const queryFTS =
    querySelect +
    (filter
      ? ` AND (search_criteria @@ websearch_to_tsquery('english', :filter) OR id = :filter)`
      : "");

  const { query: paginationQueryExpression, replacements: paginationReplacements } =
    paginationSqlExpressions(pagination);
  const queryFinal = queryFTS + paginationQueryExpression;

  const cqDirectoryEntries = await sequelize.query(queryFinal, {
    model: HIEDirectoryEntryViewModel,
    mapToModel: true,
    replacements: {
      ...paginationReplacements,
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
    (filter
      ? ` AND (search_criteria @@ websearch_to_tsquery('english', :filter) OR id = :filter)`
      : "");

  const result = await sequelize.query(queryFTS, {
    type: QueryTypes.SELECT,
    replacements: {
      ...(filter ? { filter } : {}),
    },
  });

  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  return parseInt((result[0] as unknown as any).count);
}
