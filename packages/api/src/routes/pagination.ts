import { numericValue } from "@metriport/core/external/carequality/ihe-gateway-v2/schema";
import { Config } from "@metriport/core/util/config";
import { PaginatedResponse, ResponseMeta } from "@metriport/shared";
import { Request } from "express";
import { z } from "zod";
import { Pagination } from "../command/pagination";

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
  getItems: (pagination: Pagination) => Promise<T[]>
): Promise<PaginatedResponse<T, "items">> {
  const requestMeta = getRequestMeta(req);

  const { prevPageToItem, nextPageFromItem, items } = await getPaginationItems(
    requestMeta,
    getItems
  );

  // TODO make this params compile time safe
  const responseMeta: ResponseMeta = {
    ...(prevPageToItem
      ? { prevPage: Config.getApiUrl() + req.baseUrl + "?toItem=" + prevPageToItem }
      : {}),
    ...(nextPageFromItem
      ? { nextPage: Config.getApiUrl() + req.baseUrl + "?fromItem=" + nextPageFromItem }
      : {}),
    itemsOnPage: items.length,
  };
  // TODO must create a type for this
  return { meta: responseMeta, items };
}

async function getPaginationItems<T extends { id: string }>(
  requestMeta: Pagination,
  getItems: (filterAndPagination: Pagination) => Promise<T[]>
): Promise<{
  prevPageToItem: string | undefined;
  nextPageFromItem: string | undefined;
  items: T[];
}> {
  const itemsPerPage = requestMeta.count ?? 10;

  // return the items for the current page + one more to determine if there is a next page
  const itemsWithExtraOne = await getItems({
    ...requestMeta,
    count: itemsPerPage + 1,
  });
  if (itemsWithExtraOne.length < 1) {
    return { prevPageToItem: undefined, nextPageFromItem: undefined, items: [] };
  }

  if (!requestMeta.toItem) {
    // intentionally one over since we asked for one more to determine if there is a next page
    const nextPageFromItem = itemsWithExtraOne[itemsPerPage]?.id;

    const items = itemsWithExtraOne.slice(0, itemsPerPage);

    // get the immediate item before the first one or after the last one to determine if there's a previous page
    const itemsBefore = await getItems({
      toItem: items[0]?.id,
      count: 2,
    });
    const prevPageToItem = itemsBefore.length === 2 ? itemsBefore[0]?.id : undefined;
    return { prevPageToItem, nextPageFromItem, items };
  } else {
    // intentionally one over since we asked for one more to determine if there is a next page
    const prevPageToItem =
      itemsWithExtraOne.length > itemsPerPage ? itemsWithExtraOne[0]?.id : undefined;

    // const items = itemsWithExtraOne.slice(0, itemsPerPage);
    const items =
      itemsWithExtraOne.length > itemsPerPage
        ? itemsWithExtraOne.slice(-itemsPerPage)
        : itemsWithExtraOne;

    // get the immediate item before the first one or after the last one to determine if there's a previous page
    const itemsAfter = await getItems({
      fromItem: items[items.length - 1]?.id,
      count: 2,
    });
    const nextPageFromItem = itemsAfter[1]?.id;
    return { prevPageToItem, nextPageFromItem, items };
  }
}
