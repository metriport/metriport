import { Pagination } from "../command/pagination";

export const paginationSqlExpressions = (pagination: Pagination | undefined) => {
  const { toItem, fromItem } = pagination ?? {};
  const toItemStr = toItem ? ` AND id >= :toItem` : "";
  const fromItemStr = fromItem ? ` AND id <= :fromItem` : "";
  const queryPagination = " " + [toItemStr, fromItemStr].filter(Boolean).join("");

  const queryOrder = queryPagination + " ORDER BY id " + (toItem ? "ASC" : "DESC");

  const { count } = pagination ?? {};
  const query = queryOrder + (count ? ` LIMIT :count` : "");
  const replacements = {
    ...(toItem ? { toItem } : {}),
    ...(fromItem ? { fromItem } : {}),
    ...(count ? { count } : {}),
  };
  return { query, replacements };
};
