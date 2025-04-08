import { Pagination } from "../command/pagination";

const defaultPageSize = 50;

export function paginationSqlExpressions(pagination: Pagination | undefined, alias?: string) {
  const aliasParsed = alias ? `${alias}.` : "";

  const { toItem, fromItem } = pagination ?? {};
  const toItemStr = toItem ? ` AND ${aliasParsed}id >= :toItem` : "";
  const fromItemStr = fromItem ? ` AND ${aliasParsed}id <= :fromItem` : "";
  const queryPagination = " " + [toItemStr, fromItemStr].filter(Boolean).join("");

  const queryOrder =
    queryPagination +
    ` GROUP BY ${aliasParsed}id ORDER BY ${aliasParsed}id ` +
    (toItem ? "ASC" : "DESC");

  const { count } = pagination ?? {};
  const query = queryOrder + (count ? ` LIMIT :count` : "");
  const replacements = {
    ...(toItem ? { toItem } : {}),
    ...(fromItem ? { fromItem } : {}),
    ...(count ? { count } : { count: defaultPageSize }),
  };
  return { query, replacements };
}
