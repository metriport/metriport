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
    ...(toItem ? { id: { [Op.lte]: toItem } } : undefined),
    ...(fromItem ? { id: { [Op.gte]: fromItem } } : undefined),
  };
}

export function getPaginationLimits(
  pagination: Pagination | undefined
): Pick<FindOptions, "limit"> | undefined {
  const { count } = pagination ?? {};
  return count ? { limit: count } : undefined;
}

export function getPaginationSorting(pagination: Pagination | undefined): OrderItem {
  const { toItem } = pagination ?? {};
  return ["id", toItem ? "DESC" : "ASC"];
}

export function sortForPagination<T>(items: T[], pagination: Pagination | undefined): T[] {
  const { toItem } = pagination ?? {};
  return toItem ? items.reverse() : items;
}

export async function getPaginationItems<T extends { id: string }>(
  requestMeta: Pagination,
  getItems: (filterAndPagination: Pagination) => Promise<T[]>
): Promise<{
  prevPageItem: string | undefined;
  currPageItems: T[];
  nextPageItem: string | undefined;
}> {
  const itemsPerPage = requestMeta.count;

  // return the items for the current page + one more to determine if there is a next page
  const itemsWithExtraOne = await getItems({
    ...requestMeta,
    count: itemsPerPage + 1,
  });
  if (itemsWithExtraOne.length < 1) {
    return { prevPageItem: undefined, currPageItems: [], nextPageItem: undefined };
  }

  if (!requestMeta.toItem) {
    // navigating "forward"

    // intentionally one over since we asked for one more to determine if there is a next page
    const nextPageItem = itemsWithExtraOne[itemsPerPage]?.id;

    const currPageItems = itemsWithExtraOne.slice(0, itemsPerPage);

    // get the immediate item before the first one to determine if there's a previous page
    const itemsPrevious = await getItems({
      toItem: currPageItems[0]?.id,
      count: 2,
    });
    const prevPageItem = itemsPrevious.length === 2 ? itemsPrevious[0]?.id : undefined;
    return { prevPageItem, currPageItems, nextPageItem };
  }

  // navigating "backwards"

  // intentionally expects one over since we asked for one more to determine if there is a previous page
  const prevPageItem =
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
  const nextPageItem = itemsNext[1]?.id;
  return { prevPageItem, currPageItems, nextPageItem };
}
