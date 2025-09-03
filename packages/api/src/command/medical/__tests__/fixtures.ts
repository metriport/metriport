import { SortItem } from "@metriport/shared/domain/pagination-v2";
import { CursorWhereClause, PaginationV2Context } from "../../pagination-v2";

export function makePaginationWithCursor(
  {
    count,
    fromItem,
    toItem,
    sort,
    originalSort,
  }: {
    count: number;
    fromItem?: CursorWhereClause;
    toItem?: CursorWhereClause;
    sort?: SortItem[];
    originalSort?: SortItem[];
  } = { count: 10 }
): PaginationV2Context {
  return {
    count,
    ...(fromItem ? { fromItemClause: fromItem } : {}),
    ...(toItem ? { toItemClause: toItem } : {}),
    orderByClause: "",
    sort: sort ?? [],
    originalSort: originalSort ?? [],
  };
}
