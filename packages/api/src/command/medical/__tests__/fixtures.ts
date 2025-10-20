import { SortItem } from "@metriport/shared/domain/pagination-v2";
import { CursorWhereClause, PaginationV2WithQueryClauses } from "../../pagination-v2";

export function makePaginationWithCursor(
  {
    count,
    fromItem,
    toItem,
  }: {
    count: number;
    fromItem?: CursorWhereClause;
    toItem?: CursorWhereClause;
    sort?: SortItem[];
    originalSort?: SortItem[];
  } = { count: 10 }
): PaginationV2WithQueryClauses {
  return {
    ...(fromItem ? { fromItemClause: fromItem } : { fromItemClause: { clause: "", params: {} } }),
    ...(toItem ? { toItemClause: toItem } : { toItemClause: { clause: "", params: {} } }),
    count,
    orderByClause: "",
  };
}
