import { numericValue } from "@metriport/core/external/carequality/ihe-gateway-v2/schema";
import { Config } from "@metriport/core/util/config";
import { PaginatedResponse, ResponseMeta } from "@metriport/shared";
import { Request } from "express";
import { z } from "zod";
import {
  getPaginationItems,
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
    count: numericValue
      .refine(count => count >= 0, {
        message: `Count has to be equal or greater than 0`,
      })
      .refine(count => count <= maxItemsPerPage, {
        message: `Count has to be equal or less than ${maxItemsPerPage}`,
      })
      .optional(),
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
