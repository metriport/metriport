import { CompositeCursor, createCompositeCursor } from "@metriport/shared/domain/cursor-utils";
import type { SortItem } from "@metriport/shared/domain/pagination-v2";
import { FindOptions, Op, OrderItem } from "sequelize";
import { UnionToIntersection, XOR } from "ts-essentials";

export type CursorWhereClause = {
  clause: string;
  params: Record<string, unknown>;
};

export type PaginationV2 = XOR<PaginationV2FromItem, PaginationV2ToItem> & {
  /** indicates the number of items to be included in the response */
  count: number;
  /** sort criteria for composite cursor paginationV2 (reoriented for database queries) */
  sort: SortItem[];
  /** original sort criteria as sent by client (for URL generation) */
  originalSort: SortItem[];
};

export type PaginationV2WithCursor = PaginationV2 & {
  fromItemClause?: CursorWhereClause;
  toItemClause?: CursorWhereClause;
};

export type PaginationV2FromItem = {
  /** indicates the minimum item to be included in the response, inclusive - now supports composite cursors */
  fromItem?: CompositeCursor | undefined;
};
export type PaginationV2ToItem = {
  /** indicates the maximum item to be included in the response, inclusive - now supports composite cursors */
  toItem?: CompositeCursor | undefined;
};
export type PaginationV2Item = UnionToIntersection<PaginationV2FromItem | PaginationV2ToItem>;

export function getPaginationV2Filters(paginationV2: PaginationV2 | undefined) {
  const { toItem, fromItem } = paginationV2 ?? {};
  return {
    ...(toItem ? { id: { [Op.gte]: toItem } } : undefined),
    ...(fromItem ? { id: { [Op.lte]: fromItem } } : undefined),
  };
}

export function getPaginationV2Limits(
  paginationV2: PaginationV2 | undefined
): Pick<FindOptions, "limit"> | undefined {
  const { count } = paginationV2 ?? {};
  return count ? { limit: count } : undefined;
}

export function getPaginationV2Sorting(
  paginationV2: PaginationV2 | undefined
): [string, OrderItem] {
  const { toItem } = paginationV2 ?? {};
  return ["id", toItem ? "ASC" : "DESC"];
}

export function sortForPaginationV2<T>(items: T[], paginationV2: PaginationV2 | undefined): T[] {
  const { toItem } = paginationV2 ?? {};
  return toItem ? items.reverse() : items;
}

export async function getPaginationV2Items<T extends Record<string, unknown>>(
  requestMeta: PaginationV2WithCursor,
  getItems: (paginationV2: PaginationV2WithCursor) => Promise<T[]>,
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
      toItem: createCompositeCursor(currPageItems[0], requestMeta.sort),
      sort: requestMeta.sort,
      originalSort: requestMeta.originalSort,
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
    fromItem: createCompositeCursor(currPageItems[currPageItems.length - 1], requestMeta.sort),
    sort: requestMeta.sort,
    originalSort: requestMeta.originalSort,
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

/**
 * Builds composite cursor filters for complex WHERE conditions in multi-column sorting.
 * This creates the appropriate comparison logic for cursor-based paginationV2 with custom sort orders.
 */
export function buildCompositeCursorFilters(
  cursor: CompositeCursor,
  sortFields: SortItem[],
  direction: "forward" | "backward"
): Record<string, unknown> {
  // This is a placeholder implementation for TDD
  // The actual implementation will depend on the ORM being used (Sequelize, etc.)
  // and will need to create complex WHERE clauses for multi-column comparisons

  if (Object.keys(cursor).length === 0 || sortFields.length === 0) {
    return {};
  }

  // For now, return a simple structure that indicates we have filters
  // The actual implementation would build complex OR/AND conditions
  return {
    _compositeCursorFilter: {
      cursor,
      sortFields,
      direction,
    },
  };
}
