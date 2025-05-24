import { Client } from "@opensearch-project/opensearch";
import { out } from "../../../util";
import { OpenSearchConfigDirectAccess, OpenSearchResponse, OpenSearchResponseHit } from "../index";
import { indexDefinition, SearchResult } from "../index-based-on-resource";
import { createLexicalSearchQuery } from "./lexical-search";

export type OpenSearchLexicalSearcherConfig = OpenSearchConfigDirectAccess;

export type SearchRequest = {
  cxId: string;
  patientId: string;
  query: string;
};

export class OpenSearchLexicalSearcher {
  constructor(readonly config: OpenSearchLexicalSearcherConfig) {}

  async search({ cxId, patientId, query }: SearchRequest): Promise<SearchResult[]> {
    const { log, debug } = out(`${this.constructor.name}.search - cx ${cxId}, pt ${patientId}`);

    const { indexName, endpoint, username, password } = this.config;
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
    debug(`Response: `, () => JSON.stringify(response));

    const items = response.hits.hits ?? [];
    log(`Successfully searched, got ${items.length} results`);

    return this.mapResult(items);
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

  async createIndexIfNotExists(): Promise<void> {
    const { indexName, endpoint, username, password } = this.config;
    const auth = { username, password };
    const client = new Client({ node: endpoint, auth });

    const indexExistsResp = await client.indices.exists({
      index: indexName,
      include_defaults: false,
      ignore_unavailable: false,
    });
    const indexExists = Boolean(indexExistsResp.body);
    if (indexExists) return;

    const body = { mappings: { properties: indexDefinition } };
    await client.indices.create({ index: indexName, body });
  }
}
