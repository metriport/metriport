import { Client } from "@opensearch-project/opensearch";
import { OpenSearchRequestBody, OpenSearchResponseHit, OpenSearchResponseScroll } from "./index";

/**
 * If we start to have too many pages, we can look into using a pit - point in time, it allows
 * to send requests in parallel:
 * https://docs.opensearch.org/docs/latest/search-plugins/searching-data/point-in-time/
 */

const DEFAULT_PAGE_SIZE = 10_000;
const SCROLL_DURATION_IN_MINUTES = 1;

export type PageItem = { entryId: string };

export type Response<PageItem> = {
  items: PageItem[];
  count: number;
};

/**
 * Paginate an OpenSearch search request
 * @param client The OpenSearch client
 * @param indexName The name of the index to search
 * @param searchRequest The search request to paginate
 * @param pageSize The size of the page
 * @param mapResults Function to map search hits to typed items
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
  const searchParams = { client, indexName, pageSize, mapResults };

  let page = await searchPage<T>({ ...searchParams, searchRequest });
  let scrollId = page.scrollId;
  const mutatingItems = page.items;

  while (page.items.length >= pageSize && scrollId) {
    page = await searchPage<T>({ ...searchParams, scrollId });
    mutatingItems.push(...page.items);
    scrollId = page.scrollId;
  }
  if (scrollId) await client.clearScroll({ scroll_id: scrollId });

  return { items: mutatingItems, count: mutatingItems.length };
}

async function searchPage<T>(
  params: {
    client: Client;
    indexName: string;
    pageSize: number;
    mapResults: (page: OpenSearchResponseHit<T>[]) => T[];
  } & ({ searchRequest: OpenSearchRequestBody } | { scrollId: string })
): Promise<{ scrollId: string | undefined; items: T[] }> {
  const { client, indexName, pageSize, mapResults } = params;
  const scrollDuration = `${SCROLL_DURATION_IN_MINUTES}m`;

  let body: OpenSearchResponseScroll<T>;
  if ("searchRequest" in params) {
    const { searchRequest } = params;
    const paginatedRequest = {
      ...searchRequest,
      size: pageSize,
    };
    const response = await client.search({
      index: indexName,
      body: paginatedRequest,
      scroll: scrollDuration,
    });
    body = response.body as OpenSearchResponseScroll<T>;
  } else {
    const { scrollId } = params;
    const response = await client.scroll({
      scroll_id: scrollId,
      scroll: scrollDuration,
    });
    body = response.body as OpenSearchResponseScroll<T>;
  }
  const items = body.hits.hits ?? [];
  return { scrollId: body._scroll_id, items: mapResults(items) };
}
