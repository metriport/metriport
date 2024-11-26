import { numericValue } from "@metriport/core/external/carequality/ihe-gateway-v2/schema";
import { Config } from "@metriport/core/util/config";
import { PaginatedResponse, ResponseMeta } from "@metriport/shared";
import { Request } from "express";
import { z } from "zod";
import {
  Pagination,
  PaginationFromItem,
  PaginationItem,
  PaginationToItem,
} from "../command/pagination";

export const defaultItemsPerPage = 50;
export const maxItemsPerPage = 500;

export const queryMetaSchema = z.intersection(
  z.union(
    [
      z.object({
        fromItem: z.string().optional(),
        toItem: z.never().optional(),
      }),
      z.object({
        fromItem: z.never().optional(),
        toItem: z.string().optional(),
      }),
    ],
    { errorMap: () => ({ message: "Either fromItem or toItem can be provided, but not both" }) }
  ),
  z.object({
    count: numericValue.optional().refine(count => (count ? count <= maxItemsPerPage : true), {
      message: `Count cannot be greater than ${maxItemsPerPage}`,
    }),
  })
);
export type HttpMeta = z.infer<typeof queryMetaSchema>;

export function getRequestMeta(req: Request): Pagination {
  const parsed = queryMetaSchema.parse(req.query);
  return {
    ...parsed,
    ...(parsed.count ? { count: Number(parsed.count) } : { count: defaultItemsPerPage }),
  };
}

/**
 * Function to paginate a list of items.
 *
 * @param req - The HTTP request object.
 * @param getItems - A function that takes pagination settings and returns a list of items for a given page.
 * @returns An object containing the pagination metadata and the current page's items.
 */
export async function paginated<T extends { id: string }>(
  req: Request,
  additionalQueryParams: Record<string, string> | undefined,
  getItems: (pagination: Pagination) => Promise<T[]>
): Promise<PaginatedResponse<T, "items">> {
  const requestMeta = getRequestMeta(req);

  const { prevPageItem, nextPageItem, currPageItems } = await getPaginationItems(
    requestMeta,
    getItems
  );

  const responseMeta: ResponseMeta = {
    ...(prevPageItem
      ? { prevPage: getPrevPageUrl(req, prevPageItem, requestMeta.count, additionalQueryParams) }
      : {}),
    ...(nextPageItem
      ? { nextPage: getNextPageUrl(req, nextPageItem, requestMeta.count, additionalQueryParams) }
      : {}),
    itemsOnPage: currPageItems.length,
  };
  return { meta: responseMeta, items: currPageItems };
}

async function getPaginationItems<T extends { id: string }>(
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
    return { prevPageItem: undefined, nextPageItem: undefined, currPageItems: [] };
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
    return { prevPageItem, nextPageItem, currPageItems };
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
  return { prevPageItem, nextPageItem, currPageItems };
}

function getPrevPageUrl(
  req: Request,
  prePageToItem: string,
  count: number,
  additionalQueryParams: Record<string, string> | undefined
): string {
  const p: PaginationToItem = { toItem: prePageToItem };
  return getPaginationUrl(req, p, count, additionalQueryParams);
}

function getNextPageUrl(
  req: Request,
  nextPageFromItem: string,
  count: number,
  additionalQueryParams: Record<string, string> | undefined
): string {
  const p: PaginationFromItem = { fromItem: nextPageFromItem };
  return getPaginationUrl(req, p, count, additionalQueryParams);
}

function getPaginationUrl(
  req: Request,
  item: PaginationItem,
  count: number,
  additionalQueryParams: Record<string, string> | undefined
): string {
  const params = new URLSearchParams(item);
  params.append("count", count.toString());
  if (additionalQueryParams) {
    for (const [key, value] of Object.entries(additionalQueryParams)) {
      params.append(key, value);
    }
  }
  return Config.getApiUrl() + req.baseUrl + "?" + params.toString();
}
