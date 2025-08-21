import { Config } from "@metriport/core/util/config";
import {
  createQueryMetaSchema,
  defaultItemsPerPage,
  PaginatedResponse,
  ResponseMeta,
} from "@metriport/shared";
import { Request } from "express";
import {
  getPaginationItems,
  Pagination,
  PaginationFromItem,
  PaginationItem,
  PaginationToItem,
} from "../command/pagination";

// TODO 483 remove this once pagination is fully rolled out
export function isPaginated(req: Request): boolean {
  const meta = createQueryMetaSchema().parse(req.query);
  return Object.keys(meta).length > 0;
}

export function getRequestMeta(req: Request, maxItemsPerPage: number): Pagination {
  const parsed = createQueryMetaSchema(maxItemsPerPage).parse(req.query);
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
 * @param hostUrl - The host URL to send the request to.
 * @returns An object containing the pagination metadata and the current page's items.
 */
export async function paginated<T extends { id: string }>({
  request,
  additionalQueryParams,
  getItems,
  getTotalCount,
  hostUrl = Config.getApiUrl(),
  maxItemsPerPage = 500,
}: {
  request: Request;
  additionalQueryParams: Record<string, string> | undefined;
  getItems: (pagination: Pagination) => Promise<T[]>;
  getTotalCount: () => Promise<number>;
  hostUrl?: string;
  maxItemsPerPage?: number;
}): Promise<PaginatedResponse<T, "items">> {
  const requestMeta = getRequestMeta(request, maxItemsPerPage);

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
            hostUrl
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
            hostUrl
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
  hostUrl: string
): string {
  const p: PaginationToItem = { toItem: prePageToItem };
  return getPaginationUrl(req, p, count, additionalQueryParams, hostUrl);
}

function getNextPageUrl(
  req: Request,
  nextPageFromItem: string,
  count: number,
  additionalQueryParams: Record<string, string> | undefined,
  hostUrl: string
): string {
  const p: PaginationFromItem = { fromItem: nextPageFromItem };
  return getPaginationUrl(req, p, count, additionalQueryParams, hostUrl);
}

function getPaginationUrl(
  req: Request,
  item: PaginationItem,
  count: number,
  additionalQueryParams: Record<string, string> | undefined,
  hostUrl: string
): string {
  const params = new URLSearchParams(item);
  params.append("count", count.toString());
  if (additionalQueryParams) {
    for (const [key, value] of Object.entries(additionalQueryParams)) {
      params.append(key, value);
    }
  }

  if ("_reconstructedRoute" in req) {
    return hostUrl + req._reconstructedRoute + "?" + params.toString();
  }
  return hostUrl + req.baseUrl + "?" + params.toString();
}
