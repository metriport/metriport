import { CompositeCursor, createCompositeCursor } from "@metriport/shared/domain/cursor-utils";
import type { SortItem } from "@metriport/shared/domain/pagination";
import { FindOptions, Op, OrderItem } from "sequelize";
import { UnionToIntersection, XOR } from "ts-essentials";

export type Pagination = XOR<PaginationFromItem, PaginationToItem> & {
  /** indicates the number of items to be included in the response */
  count: number;
  /** optional sort criteria for composite cursor pagination */
  sort: SortItem[];
};

export type PaginationFromItem = {
  /** indicates the minimum item to be included in the response, inclusive - now supports composite cursors */
  fromItem?: CompositeCursor | undefined;
};
export type PaginationToItem = {
  /** indicates the maximum item to be included in the response, inclusive - now supports composite cursors */
  toItem?: CompositeCursor | undefined;
};
export type PaginationItem = UnionToIntersection<PaginationFromItem | PaginationToItem>;

export function getPaginationFilters(pagination: Pagination | undefined) {
  const { toItem, fromItem } = pagination ?? {};
  return {
    ...(toItem ? { id: { [Op.gte]: toItem } } : undefined),
    ...(fromItem ? { id: { [Op.lte]: fromItem } } : undefined),
  };
}

export function getPaginationLimits(
  pagination: Pagination | undefined
): Pick<FindOptions, "limit"> | undefined {
  const { count } = pagination ?? {};
  return count ? { limit: count } : undefined;
}

export function getPaginationSorting(pagination: Pagination | undefined): [string, OrderItem] {
  const { toItem } = pagination ?? {};
  return ["id", toItem ? "ASC" : "DESC"];
}

export function sortForPagination<T>(items: T[], pagination: Pagination | undefined): T[] {
  const { toItem } = pagination ?? {};
  return toItem ? items.reverse() : items;
}

export async function getPaginationItems<T extends Record<string, unknown>>(
  requestMeta: Pagination,
  getItems: (pagination: Pagination) => Promise<T[]>,
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
 * This creates the appropriate comparison logic for cursor-based pagination with custom sort orders.
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

/**
 * Gets the appropriate sorting configuration for composite cursor pagination.
 * Handles multi-column sorting with proper direction reversal for backward pagination.
 */
export function getPaginationSortingComposite(pagination: Pagination | undefined): OrderItem[] {
  const { sort, toItem } = pagination ?? {};

  if (!sort || sort.length === 0) {
    return [["id", toItem ? "ASC" : "DESC"]];
  }

  const orderItems: OrderItem[] = sort.map(({ col, order }) => [
    col,
    toItem ? (order === "asc" ? "DESC" : "ASC") : order === "asc" ? "ASC" : "DESC",
  ]);

  // Always include id as final sort to ensure deterministic ordering
  orderItems.push(["id", toItem ? "ASC" : "DESC"]);
  return orderItems;
}
