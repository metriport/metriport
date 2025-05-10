import { BadRequestError } from "@metriport/shared";
import { Client } from "@opensearch-project/opensearch";
import { out } from "../../../util";
import { OpenSearchConfigDirectAccess, OpenSearchResponseHit, OpenSearchResponse } from "../index";
import { SearchResult } from "../index-based-on-resource";
import { createLexicalSearchQuery } from "./lexical-search";

const defaultNumberOfResults = 100;

export type OpenSearchLexicalSearcherDirectConfig = OpenSearchConfigDirectAccess;

// TODO ENG-268 move to superclass when we have one
export type SearchRequest = {
  cxId: string;
  patientId: string;
  // https://www.elastic.co/guide/en/elasticsearch/reference/8.5/query-dsl-query-string-query.html#_boolean_operators
  query: string;
  /** From 0 to 10_000, optional, defaults to 100 */
  maxNumberOfResults?: number | undefined;
};

export class OpenSearchLexicalSearcherDirect {
  constructor(readonly config: OpenSearchLexicalSearcherDirectConfig) {}

  async search({
    cxId,
    patientId,
    query,
    maxNumberOfResults = defaultNumberOfResults,
  }: SearchRequest): Promise<SearchResult[]> {
    const { indexName, endpoint, username, password } = this.config;
    const { log, debug } = out(`OpenSearchLexicalSearcherDirect - cx ${cxId}, pt ${patientId}`);

    this.validateMaxNumberOfResults(maxNumberOfResults);

    const auth = { username, password };
    const client = new Client({ node: endpoint, auth });

    log(`Searching on index ${indexName}...`);
    const queryPayload = createLexicalSearchQuery({
      cxId,
      patientId,
      query,
    });

    const response = (
      await client.search({
        index: indexName,
        body: queryPayload,
      })
    ).body as OpenSearchResponse<SearchResult>;
    // TODO eng-41 Remove this
    debug(`Response: `, () => JSON.stringify(response));

    const items = response.hits.hits ?? [];
    log(`Successfully searched, got ${items.length} results`);

    return this.mapResult(items);
  }

  private validateMaxNumberOfResults(maxNumberOfResults: number) {
    if (maxNumberOfResults > 10_000) {
      throw new BadRequestError("maxNumberOfResults cannot be greater than 10_000");
    }
    if (maxNumberOfResults < 1) {
      throw new BadRequestError("maxNumberOfResults cannot be less than 1");
    }
  }

  private mapResult(input: OpenSearchResponseHit<SearchResult>[]): SearchResult[] {
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
