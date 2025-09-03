import {
  CompositeCursor,
  createCompositeCursor,
  CursorPrimitive,
} from "@metriport/shared/domain/cursor-utils";
import type { SortItem } from "@metriport/shared/domain/pagination-v2";
import { UnionToIntersection, XOR } from "ts-essentials";

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

// export type PaginationV2FromItemClause = {
//   fromItemClause?: CursorWhereClause | undefined;
// };
// export type PaginationV2ToItemClause = {
//   toItemClause?: CursorWhereClause | undefined;
// };
export type PaginationV2WithQueryClauses = {
  fromItemClause?: CursorWhereClause | undefined;
  toItemClause?: CursorWhereClause | undefined;
  orderByClause: string;
  count: number;
};
export type PaginationV2WithCursor = PaginationV2 & {
  fromItemClause?: CursorWhereClause | undefined;
  toItemClause?: CursorWhereClause | undefined;
  orderByClause: string;
};

export async function getPaginationV2Items<T extends Record<string, unknown>>(
  requestMeta: PaginationV2WithCursor,
  getItems: (paginationV2: PaginationV2WithQueryClauses) => Promise<T[]>,
  getTotalCount: () => Promise<number>
): Promise<{
  prevPageCursor: CompositeCursor | undefined;
  currPageItems: T[];
  nextPageCursor: CompositeCursor | undefined;
  totalCount?: number;
}> {
  const itemsPerPage = requestMeta.count;

  // return the items for the current page + one more to determine if there is a next page
  const itemsWithExtraOne = await getItems({
    ...requestMeta,
    count: itemsPerPage + 1,
  });
  if (itemsWithExtraOne.length < 1) {
    return { prevPageCursor: undefined, currPageItems: [], nextPageCursor: undefined };
  }

  if (!requestMeta.toItem) {
    // navigating "forward"

    // intentionally one over since we asked for one more to determine if there is a next page
    const nextPageCursor = itemsWithExtraOne[itemsPerPage]
      ? createCompositeCursor(itemsWithExtraOne[itemsPerPage], requestMeta.sort)
      : undefined;

    const currPageItems = itemsWithExtraOne.slice(0, itemsPerPage);

    if (!requestMeta.fromItem) {
      // first page, default request without "fromItem"
      const totalCount = await getTotalCount();
      return { prevPageCursor: undefined, currPageItems, nextPageCursor, totalCount };
    }

    // get the immediate item before the first one to determine if there's a previous page
    const itemsPrevious = await getItems({
      toItemClause: requestMeta.toItemClause,
      orderByClause: requestMeta.orderByClause,
      count: 2,
    });
    const prevPageCursor =
      itemsPrevious.length === 2
        ? createCompositeCursor(itemsPrevious[0], requestMeta.sort)
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
      ? createCompositeCursor(itemsWithExtraOne[0], requestMeta.sort)
      : undefined;

  const currPageItems =
    itemsWithExtraOne.length > itemsPerPage
      ? itemsWithExtraOne.slice(-itemsPerPage)
      : itemsWithExtraOne;

  // get the immediate item after the last one to determine if there's a next page
  const itemsNext = await getItems({
    fromItemClause: requestMeta.fromItemClause,
    orderByClause: requestMeta.orderByClause,
    count: 2,
  });
  const nextPageCursor = itemsNext[1]
    ? createCompositeCursor(itemsNext[1], requestMeta.sort)
    : undefined;

  if (!prevPageCursor) {
    // first page, navigating backwards
    const totalCount = await getTotalCount();
    return { prevPageCursor, currPageItems, nextPageCursor, totalCount };
  }
  return { prevPageCursor, currPageItems, nextPageCursor };
}
