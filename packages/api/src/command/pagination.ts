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
