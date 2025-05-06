import { Client } from "@opensearch-project/opensearch";
import { contentFieldName } from "..";
import { out } from "../../../util";
import { OpenSearchFileSearcherConfig, SearchRequest } from "../file-searcher";
import { IngestRequest } from "../text-ingestor-direct";
import { createHybridSearchQuery } from "./hybrid-search";

export type OpenSearchSemanticSearcherDirectConfig = OpenSearchFileSearcherConfig & {
  endpoint: string;
  username: string;
  password: string;
  modelId: string;
  /** From 0 to 10_000, optional, defaults to 10 */
  maxNumberOfResults?: number | undefined;
};

export type SearchResult = Omit<IngestRequest, "content">;

// https://github.com/opensearch-project/opensearch-js/issues/269
export type OpenSearchResponseHit = {
  _index: string;
  _id: string;
  _score: number;
  _source: SearchResult;
};
// https://github.com/opensearch-project/opensearch-js/issues/269
export type OpenSearchResponse = {
  hits: {
    hits?: OpenSearchResponseHit[];
  };
};

export class OpenSearchSemanticSearcherDirect {
  constructor(readonly config: OpenSearchSemanticSearcherDirectConfig) {}

  async search(req: SearchRequest): Promise<SearchResult[]> {
    const { indexName, endpoint, username, password, modelId, maxNumberOfResults } = this.config;
    const { cxId, patientId, query } = req;
    const { log, debug } = out(`OpenSearchSemanticSearcherDirect - cx ${cxId}, pt ${patientId}`);

    const auth = { username, password };
    const client = new Client({ node: endpoint, auth });

    log(`Searching on index ${indexName}...`);
    const queryPayload = createHybridSearchQuery({
      cxId,
      patientId,
      query,
      modelId,
      k: maxNumberOfResults,
    });

    const response = (
      await client.search(
        {
          index: indexName,
          body: queryPayload,
        },
        {
          querystring: {
            // removes the "content" from the response
            filter_path: `-hits.hits._source.${contentFieldName}`,
          },
        }
      )
    ).body as OpenSearchResponse;
    // TODO eng-41 Remove this
    debug(`Response: `, () => JSON.stringify(response));

    const items = response.hits.hits ?? [];

    log(`Successfully searched, got ${items.length} results`);

    return this.mapResult(items);
  }

  private mapResult(input: OpenSearchResponseHit[]): SearchResult[] {
    if (!input) return [];
    return input.map(hit => {
      return {
        cxId: hit._source.cxId,
        patientId: hit._source.patientId,
        resourceType: hit._source.resourceType,
        resourceId: hit._source.resourceId,
      };
    });
  }
}
