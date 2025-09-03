import { SortItem } from "@metriport/shared/domain/pagination-v2";
import { CursorWhereClause, PaginationV2WithCursor } from "../../pagination-v2";

export function makePaginationWithCursor(
  {
    count,
    fromItemClause,
    toItemClause,
    sort,
    originalSort,
  }: {
    count: number;
    fromItemClause?: CursorWhereClause;
    toItemClause?: CursorWhereClause;
    sort?: SortItem[];
    originalSort?: SortItem[];
  } = { count: 10 }
): PaginationV2WithCursor {
  return {
    count,
    ...(fromItemClause ? { fromItemClause } : {}),
    ...(toItemClause ? { toItemClause } : {}),
    sort: sort ?? [],
    originalSort: originalSort ?? [],
  };
}
