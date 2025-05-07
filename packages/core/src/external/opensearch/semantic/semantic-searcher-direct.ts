import { BadRequestError } from "@metriport/shared";
import { Client } from "@opensearch-project/opensearch";
import { out } from "../../../util";
import { OpenSearchFileSearcherConfig } from "../file-searcher";
import { IngestRequest } from "../text-ingestor-direct";
import { createHybridSearchQuery } from "./hybrid-search";

const defaultSimilarityThreshold = 0.2;
const defaultNumberOfResults = 100;

export type OpenSearchSemanticSearcherDirectConfig = OpenSearchFileSearcherConfig & {
  endpoint: string;
  username: string;
  password: string;
  modelId: string;
};

export type SearchRequest = {
  cxId: string;
  patientId: string;
  // https://www.elastic.co/guide/en/elasticsearch/reference/8.5/query-dsl-query-string-query.html#_boolean_operators
  query: string;
  /** From 0 to 10_000, optional, defaults to 100 */
  maxNumberOfResults?: number | undefined;
  /** From 0 to 1, optional, defaults to 0.2 */
  similarityThreshold?: number | undefined;
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

  async search({
    cxId,
    patientId,
    query,
    maxNumberOfResults = defaultNumberOfResults,
    similarityThreshold = defaultSimilarityThreshold,
  }: SearchRequest): Promise<SearchResult[]> {
    const { indexName, endpoint, username, password, modelId } = this.config;
    const { log, debug } = out(`OpenSearchSemanticSearcherDirect - cx ${cxId}, pt ${patientId}`);

    this.validateMaxNumberOfResults(maxNumberOfResults);
    this.validateSimilarityThreshold(similarityThreshold);

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
      await client.search({
        index: indexName,
        body: queryPayload,
      })
    ).body as OpenSearchResponse;
    // TODO eng-41 Remove this
    debug(`Response: `, () => JSON.stringify(response));

    const items = response.hits.hits ?? [];
    log(`Successfully searched, got ${items.length} results`);

    const filteredItems = items.filter(item => item._score >= similarityThreshold);
    if (filteredItems.length !== items.length) {
      log(
        `Filtered ${
          items.length - filteredItems.length
        } results due to similarity threshold (${similarityThreshold})`
      );
    }

    return this.mapResult(filteredItems);
  }

  private validateMaxNumberOfResults(maxNumberOfResults: number) {
    if (maxNumberOfResults > 10_000) {
      throw new BadRequestError("maxNumberOfResults cannot be greater than 10_000");
    }
    if (maxNumberOfResults < 1) {
      throw new BadRequestError("maxNumberOfResults cannot be less than 1");
    }
  }

  private validateSimilarityThreshold(similarityThreshold: number) {
    if (similarityThreshold > 1) {
      throw new BadRequestError("similarityThreshold cannot be greater than 1");
    }
    if (similarityThreshold <= 0) {
      throw new BadRequestError("similarityThreshold cannot be less than or equal to 0");
    }
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
