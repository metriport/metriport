import { FindOptions, Op, OrderItem } from "sequelize";
import { UnionToIntersection, XOR } from "ts-essentials";

export type Pagination = XOR<PaginationFromItem, PaginationToItem> & {
  /** indicates the number of items to be included in the response */
  count: number;
};

export type PaginationFromItem = {
  /** indicates the minimum item to be included in the response, inclusive */
  fromItem?: string | undefined;
};
export type PaginationToItem = {
  /** indicates the maximum item to be included in the response, inclusive */
  toItem?: string | undefined;
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

export async function getPaginationItems<T extends { id: string }>(
  requestMeta: Pagination,
  getItems: (pagination: Pagination) => Promise<T[]>,
  getTotalCount: () => Promise<number>
): Promise<{
  prevPageItemId: string | undefined;
  currPageItems: T[];
  nextPageItemId: string | undefined;
  totalCount?: number;
}> {
  const itemsPerPage = requestMeta.count;

  // return the items for the current page + one more to determine if there is a next page
  const itemsWithExtraOne = await getItems({
    ...requestMeta,
    count: itemsPerPage + 1,
  });
  if (itemsWithExtraOne.length < 1) {
    return { prevPageItemId: undefined, currPageItems: [], nextPageItemId: undefined };
  }

  if (!requestMeta.toItem) {
    // navigating "forward"

    // intentionally one over since we asked for one more to determine if there is a next page
    const nextPageItemId = itemsWithExtraOne[itemsPerPage]?.id;

    const currPageItems = itemsWithExtraOne.slice(0, itemsPerPage);

    if (!requestMeta.fromItem) {
      // first page, default request without "fromItem"
      const totalCount = await getTotalCount();
      return { prevPageItemId: undefined, currPageItems, nextPageItemId, totalCount };
    }

    // get the immediate item before the first one to determine if there's a previous page
    const itemsPrevious = await getItems({
      toItem: currPageItems[0]?.id,
      count: 2,
    });
    const prevPageItemId = itemsPrevious.length === 2 ? itemsPrevious[0]?.id : undefined;

    if (!prevPageItemId) {
      // first page, but provided a "fromItem"
      const totalCount = await getTotalCount();
      return { prevPageItemId, currPageItems, nextPageItemId, totalCount };
    }

    return { prevPageItemId, currPageItems, nextPageItemId };
  }

  // navigating "backwards"

  // intentionally expects one over since we asked for one more to determine if there is a previous page
  const prevPageItemId =
    itemsWithExtraOne.length > itemsPerPage ? itemsWithExtraOne[0]?.id : undefined;

  const currPageItems =
    itemsWithExtraOne.length > itemsPerPage
      ? itemsWithExtraOne.slice(-itemsPerPage)
      : itemsWithExtraOne;

  // get the immediate item after the last one to determine if there's a next page
  const itemsNext = await getItems({
    fromItem: currPageItems[currPageItems.length - 1]?.id,
    count: 2,
  });
  const nextPageItemId = itemsNext[1]?.id;

  if (!prevPageItemId) {
    // first page, navigating backwards
    const totalCount = await getTotalCount();
    return { prevPageItemId, currPageItems, nextPageItemId, totalCount };
  }
  return { prevPageItemId, currPageItems, nextPageItemId };
}
