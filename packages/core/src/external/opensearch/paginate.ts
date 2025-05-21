import { Client } from "@opensearch-project/opensearch";
import { out } from "../../util";
import { OpenSearchRequestBody, OpenSearchResponse, OpenSearchResponseHit } from "./index";

/**
 * If we start to have too many pages, we can look into using a pit - point in time, it allows
 * to send requests in parallel:
 * https://docs.opensearch.org/docs/latest/search-plugins/searching-data/point-in-time/
 */

const DEFAULT_PAGE_SIZE = 10_000;

export type PageItem = { id: string };

export type Response<PageItem> = {
  items: PageItem[];
  count: number;
};

/**
 * Paginate an OpenSearch search request
 * @param client The OpenSearch client
 * @param searchRequest The search request to paginate
 * @param pageSize The size of the page
 * @param pageNumber The number of the page
 * @returns The paginated search request
 */
export async function paginatedSearch<T extends PageItem>({
  client,
  indexName,
  searchRequest,
  pageSize = DEFAULT_PAGE_SIZE,
  mapResults,
}: {
  client: Client;
  indexName: string;
  searchRequest: OpenSearchRequestBody;
  pageSize?: number | undefined;
  mapResults: (page: OpenSearchResponseHit<T>[]) => T[];
}): Promise<Response<T>> {
  const searchParams = { client, indexName, searchRequest, pageSize, mapResults };

  let page = await searchPage<T>(searchParams);
  const mutatingItems = page;

  while (page.length >= pageSize) {
    const lastItem = page[page.length - 1];
    if (!lastItem) break;

    page = await searchPage<T>({
      ...searchParams,
      searchAfter: lastItem.id,
    });
    mutatingItems.push(...page);
  }

  return { items: mutatingItems, count: mutatingItems.length };
}

async function searchPage<T>({
  client,
  indexName,
  searchRequest,
  pageSize,
  searchAfter,
  mapResults,
}: {
  client: Client;
  indexName: string;
  searchRequest: OpenSearchRequestBody;
  pageSize: number;
  searchAfter?: string | undefined;
  mapResults: (page: OpenSearchResponseHit<T>[]) => T[];
}): Promise<T[]> {
  const { debug } = out(`searchPage`);
  const paginatedRequest = {
    ...searchRequest,
    size: pageSize,
    sort: "_id",
    ...(searchAfter ? { search_after: [searchAfter] } : {}),
  };
  const response = await client.search({ index: indexName, body: paginatedRequest });
  const body = response.body as OpenSearchResponse<T>;
  debug(`Response: `, () => JSON.stringify(response));
  if (!body.hits.hits) return [];
  return mapResults(body.hits.hits);
}
