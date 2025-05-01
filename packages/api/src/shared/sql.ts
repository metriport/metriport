import { Pagination } from "../command/pagination";

const defaultPageSize = 50;

export function paginationSqlExpressions({
  pagination,
  addGroupBy,
  alias,
}: {
  pagination: Pagination | undefined;
  addGroupBy?: boolean;
  alias?: string;
}) {
  const aliasParsed = alias ? `${alias}.` : "";

  const { toItem, fromItem } = pagination ?? {};
  const toItemStr = toItem ? ` AND ${aliasParsed}id >= :toItem` : "";
  const fromItemStr = fromItem ? ` AND ${aliasParsed}id <= :fromItem` : "";
  const queryPagination = " " + [toItemStr, fromItemStr].filter(Boolean).join("");

  const queryGroupBy = queryPagination + (addGroupBy ? ` GROUP BY ${aliasParsed}id` : "");
  const queryOrder = queryGroupBy + ` ORDER BY ${aliasParsed}id ` + (toItem ? "ASC" : "DESC");

  const { count } = pagination ?? {};
  const query = queryOrder + (count ? ` LIMIT :count` : "");
  const replacements = {
    ...(toItem ? { toItem } : {}),
    ...(fromItem ? { fromItem } : {}),
    ...(count ? { count } : { count: defaultPageSize }),
  };
  return { query, replacements };
}
