import {
  CompositeCursor,
  createCompositeCursor,
  CursorPrimitive,
} from "@metriport/shared/domain/cursor-utils";
import type { SortItem } from "@metriport/shared/domain/pagination-v2";
import { UnionToIntersection, XOR } from "ts-essentials";
import { buildCompositeCursorWhereClause, ColumnValidationConfig } from "../routes/pagination-v2";

export type CursorWhereClause = {
  clause: string;
  params: Record<string, CursorPrimitive>;
};

export type PaginationV2FromItem = {
  /** indicates the first item of the page in the response, inclusive */
  fromItem?: CompositeCursor | undefined;
};
export type PaginationV2ToItem = {
  /** indicates the last item of the page in the response, inclusive */
  toItem?: CompositeCursor | undefined;
};
export type PaginationV2Item = UnionToIntersection<PaginationV2FromItem | PaginationV2ToItem>;
export type PaginationV2 = XOR<PaginationV2FromItem, PaginationV2ToItem> & {
  /** indicates the number of items to be included in the response */
  count: number;
  /** sort criteria for composite cursor paginationV2 (reoriented for database queries) */
  sort: SortItem[];
  /** original sort criteria as sent by client (for URL generation) */
  originalSort: SortItem[];
};

export type PaginationV2WithQueryClauses = {
  fromItemClause: CursorWhereClause;
  toItemClause: CursorWhereClause;
  orderByClause: string;
  count: number;
};

export type PaginationV2Context = PaginationV2 & {
  fromItemClause?: CursorWhereClause | undefined;
  toItemClause?: CursorWhereClause | undefined;
  allowedSortColumns: ColumnValidationConfig;
  orderByClause: string;
  orderByClauseBackward: string;
};

export async function getPaginationV2Items<T extends Record<string, unknown>>(
  context: PaginationV2Context,
  getItems: (paginationV2: PaginationV2WithQueryClauses) => Promise<T[]>,
  getTotalCount: () => Promise<number>
): Promise<{
  prevPageCursor: CompositeCursor | undefined;
  currPageItems: T[];
  nextPageCursor: CompositeCursor | undefined;
  totalCount?: number;
}> {
  const itemsPerPage = context.count;

  // return the items for the current page + one more to determine if there is a next page
  const itemsWithExtraOne = await getItems({
    fromItemClause: context.fromItemClause || { clause: "", params: {} },
    toItemClause: context.toItemClause || { clause: "", params: {} },
    orderByClause: context.orderByClause,
    count: itemsPerPage + 1,
  });
  if (itemsWithExtraOne.length < 1) {
    return { prevPageCursor: undefined, currPageItems: [], nextPageCursor: undefined };
  }

  if (!context.toItem) {
    // navigating "forward"

    const currPageItems = itemsWithExtraOne.slice(0, itemsPerPage);

    // intentionally one over since we asked for one more to determine if there is a next page
    const nextPageCursor = itemsWithExtraOne[itemsPerPage]
      ? createCompositeCursor(itemsWithExtraOne[itemsPerPage], context.sort)
      : undefined;

    if (!context.fromItem) {
      // first page, default request without "fromItem"
      const totalCount = await getTotalCount();
      return { prevPageCursor: undefined, currPageItems, nextPageCursor, totalCount };
    }

    // get the immediate item before the first one to determine if there's a previous page
    const firstItemOfCurrentPage = createCompositeCursor(currPageItems[0], context.sort);
    const toItemClause = buildCompositeCursorWhereClause(
      firstItemOfCurrentPage,
      context.sort,
      "backward",
      context.allowedSortColumns
    );
    const itemsPrevious = await getItems({
      fromItemClause: { clause: "", params: {} },
      toItemClause,
      orderByClause: context.orderByClause,
      count: 2,
    });
    const prevPageCursor =
      itemsPrevious.length === 2
        ? createCompositeCursor(itemsPrevious[1], context.sort)
        : undefined;

    if (!prevPageCursor) {
      // first page, but provided a "fromItem"
      const totalCount = await getTotalCount();
      return { prevPageCursor, currPageItems, nextPageCursor, totalCount };
    }

    return { prevPageCursor, currPageItems, nextPageCursor };
  }

  // navigating "backwards"

  // intentionally expects one over since we asked for one more to determine if there is a previous page
  const prevPageCursor =
    itemsWithExtraOne.length > itemsPerPage
      ? createCompositeCursor(itemsWithExtraOne[0], context.sort)
      : undefined;

  const currPageItems =
    itemsWithExtraOne.length > itemsPerPage
      ? itemsWithExtraOne.slice(0, itemsPerPage)
      : itemsWithExtraOne;

  // get the last item of the page plus an extra to see if there is another page before it.
  const lastItemOfCurrentPage = createCompositeCursor(
    currPageItems[currPageItems.length - 1],
    context.sort
  );
  const itemsNext = await getItems({
    fromItemClause: buildCompositeCursorWhereClause(
      lastItemOfCurrentPage,
      context.sort,
      "forward",
      context.allowedSortColumns
    ),
    toItemClause: { clause: "", params: {} },
    orderByClause: context.orderByClause,
    count: 2,
  });
  const nextPageCursor = itemsNext[1]
    ? createCompositeCursor(itemsNext[1], context.sort)
    : undefined;

  if (!prevPageCursor) {
    // first page, navigating backwards
    const totalCount = await getTotalCount();
    return { prevPageCursor, currPageItems, nextPageCursor, totalCount };
  }
  return { prevPageCursor, currPageItems, nextPageCursor };
}
