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
        message: `Count has to be greater than or equal to 0`,
      })
      .refine(count => count <= maxItemsPerPage, {
        message: `Count has to be less than or equal to ${maxItemsPerPage}`,
      })
      .optional(),
  })
);
export type HttpMeta = z.infer<typeof queryMetaSchema>;

// TODO 483 remove this once pagination is fully rolled out
export function isPaginated(req: Request): boolean {
  const meta = queryMetaSchema.parse(req.query);
  return Object.keys(meta).length > 0;
}

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
 * @param request - The HTTP request object.
 * @param additionalQueryParams - Additional query parameters to be included in the pagination URL.
 * @param getItems - A function that takes pagination settings and returns a list of items for a given page.
 * @param getTotalCount - A function that returns the total number of items in all pages.
 * @param isInternal - A flag to determine if the request is internal (for constructing URLs).
 * @returns An object containing the pagination metadata and the current page's items.
 */
export async function paginated<T extends { id: string }>({
  request,
  additionalQueryParams,
  getItems,
  getTotalCount,
  isInternal = false,
}: {
  request: Request;
  additionalQueryParams: Record<string, string> | undefined;
  getItems: (pagination: Pagination) => Promise<T[]>;
  getTotalCount: () => Promise<number>;
  isInternal?: boolean;
}): Promise<PaginatedResponse<T, "items">> {
  const requestMeta = getRequestMeta(request);

  const { prevPageItemId, nextPageItemId, currPageItems, totalCount } = await getPaginationItems(
    requestMeta,
    getItems,
    getTotalCount
  );

  const responseMeta: ResponseMeta = {
    ...(prevPageItemId
      ? {
          prevPage: getPrevPageUrl(
            request,
            prevPageItemId,
            requestMeta.count,
            additionalQueryParams,
            isInternal
          ),
        }
      : {}),
    ...(nextPageItemId
      ? {
          nextPage: getNextPageUrl(
            request,
            nextPageItemId,
            requestMeta.count,
            additionalQueryParams,
            isInternal
          ),
        }
      : {}),
    itemsOnPage: currPageItems.length,
    itemsInTotal: totalCount,
  };
  return { meta: responseMeta, items: currPageItems };
}

function getPrevPageUrl(
  req: Request,
  prePageToItem: string,
  count: number,
  additionalQueryParams: Record<string, string> | undefined,
  isInternal: boolean
): string {
  const p: PaginationToItem = { toItem: prePageToItem };
  return getPaginationUrl(req, p, count, additionalQueryParams, isInternal);
}

function getNextPageUrl(
  req: Request,
  nextPageFromItem: string,
  count: number,
  additionalQueryParams: Record<string, string> | undefined,
  isInternal: boolean
): string {
  const p: PaginationFromItem = { fromItem: nextPageFromItem };
  return getPaginationUrl(req, p, count, additionalQueryParams, isInternal);
}

function getPaginationUrl(
  req: Request,
  item: PaginationItem,
  count: number,
  additionalQueryParams: Record<string, string> | undefined,
  isInternal: boolean
): string {
  const params = new URLSearchParams(item);
  params.append("count", count.toString());
  if (additionalQueryParams) {
    for (const [key, value] of Object.entries(additionalQueryParams)) {
      params.append(key, value);
    }
  }

  if ("_reconstructedRoute" in req) {
    return getHostUrl(isInternal) + req._reconstructedRoute + "?" + params.toString();
  }
  return getHostUrl(isInternal) + req.baseUrl + "?" + params.toString();
}

function getHostUrl(isInternal: boolean) {
  return isInternal ? Config.getApiLoadBalancerAddress() : Config.getApiUrl();
}
