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
    const { indexName, endpoint, username, password, modelId } = this.config;
    const { cxId, patientId, query } = req;
    const { log, debug } = out(`OpenSearchSemanticSearcherDirect - cx ${cxId}, pt ${patientId}`);

    const auth = { username, password };
    const client = new Client({ node: endpoint, auth });

    log(`Searching on index ${indexName}...`);
    const queryPayload = createHybridSearchQuery({ cxId, patientId, query, modelId });

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
    debug(`Successfully searched, response: `, () => JSON.stringify(response));

    return this.mapResult(response);
  }

  private mapResult(input: OpenSearchResponse): SearchResult[] {
    if (!input.hits || !input.hits.hits) return [];
    return input.hits.hits.map(hit => {
      return {
        cxId: hit._source.cxId,
        patientId: hit._source.patientId,
        resourceType: hit._source.resourceType,
        resourceId: hit._source.resourceId,
      };
    });
  }
}
