import { Config } from "@metriport/core/util/config";
import {
  CompositeCursor,
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
import { encodeCursor } from "@metriport/shared/domain/cursor-utils";

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

  const { prevPageCursor, nextPageCursor, currPageItems, totalCount } = await getPaginationItems(
    requestMeta,
    getItems,
    getTotalCount
  );

  const responseMeta: ResponseMeta = {
    ...(prevPageCursor
      ? {
          prevPage: getPrevPageUrl(
            request,
            prevPageCursor,
            requestMeta,
            additionalQueryParams,
            hostUrl
          ),
        }
      : {}),
    ...(nextPageCursor
      ? {
          nextPage: getNextPageUrl(
            request,
            nextPageCursor,
            requestMeta,
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
  prePageToItem: CompositeCursor,
  requestMeta: Pagination,
  additionalQueryParams: Record<string, string> | undefined,
  hostUrl: string
): string {
  const p: PaginationToItem = { toItem: prePageToItem };
  return getPaginationUrl(req, p, requestMeta, additionalQueryParams, hostUrl);
}

function getNextPageUrl(
  req: Request,
  nextPageFromItem: CompositeCursor,
  requestMeta: Pagination,
  additionalQueryParams: Record<string, string> | undefined,
  hostUrl: string
): string {
  const p: PaginationFromItem = { fromItem: nextPageFromItem };
  return getPaginationUrl(req, p, requestMeta, additionalQueryParams, hostUrl);
}

function getPaginationUrl(
  req: Request,
  item: PaginationItem,
  requestMeta: Pagination,
  additionalQueryParams: Record<string, string> | undefined,
  hostUrl: string
): string {
  const encodedItem = {
    ...(item.fromItem ? { fromItem: encodeCursor(item.fromItem) } : {}),
    ...(item.toItem ? { toItem: encodeCursor(item.toItem) } : {}),
  };

  const params = new URLSearchParams(encodedItem);
  params.append("count", requestMeta.count.toString());
  params.append("sort", requestMeta.sort.map(s => `${s.col}=${s.order}`).join(","));
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
