import { SortItem } from "@metriport/shared/domain/pagination-v2";
import { CursorWhereClause, PaginationV2WithCursor } from "../../pagination-v2";

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
): PaginationV2WithCursor {
  return {
    count,
    ...(fromItem ? { fromItem } : {}),
    ...(toItem ? { toItem } : {}),
    sort: sort ?? [],
    originalSort: originalSort ?? [],
  };
}
