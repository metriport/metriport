import { errorToString } from "@metriport/shared";
import { Client } from "@opensearch-project/opensearch";
import { out } from "../../../util";
import {
  OpenSearchConfigDirectAccess,
  OpenSearchResponse,
  OpenSearchResponseGet,
  OpenSearchResponseHit,
} from "../index";
import { FhirSearchResult } from "../index-based-on-fhir";
import { indexDefinition } from "../index-based-on-resource";
import { getEntryId } from "../shared/id";
import { createLexicalSearchQuery } from "./lexical-search";

export type OpenSearchFhirSearcherConfig = OpenSearchConfigDirectAccess;

export type SearchRequest = {
  cxId: string;
  patientId: string;
  query: string;
};

export type GetByIdRequest = {
  cxId: string;
  patientId: string;
  resourceId: string;
};

export class OpenSearchFhirSearcher {
  constructor(readonly config: OpenSearchFhirSearcherConfig) {}

  async search({ cxId, patientId, query }: SearchRequest): Promise<FhirSearchResult[]> {
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
    ).body as OpenSearchResponse<FhirSearchResult>;
    debug(`Response: `, () => JSON.stringify(response));

    const items = response.hits.hits ?? [];
    log(`Successfully searched, got ${items.length} results`);

    return this.mapResult(items);
  }

  async getById(id: string): Promise<FhirSearchResult | undefined>;
  async getById({
    cxId,
    patientId,
    resourceId,
  }: GetByIdRequest): Promise<FhirSearchResult | undefined>;
  async getById(params: string | GetByIdRequest): Promise<FhirSearchResult | undefined> {
    const { log, debug } = out(
      `${this.constructor.name}.getById - params ${JSON.stringify(params)}`
    );

    const entryId =
      typeof params === "string"
        ? params
        : getEntryId(params.cxId, params.patientId, params.resourceId);

    const { indexName, endpoint, username, password } = this.config;
    const auth = { username, password };
    const client = new Client({ node: endpoint, auth });

    log(`Getting by id ${entryId} on index ${indexName}...`);
    try {
      const response = (
        await client.get({
          index: indexName,
          id: entryId,
        })
      ).body as OpenSearchResponseGet<FhirSearchResult>;
      debug(`Response: `, () => JSON.stringify(response));

      if (!response.found) return undefined;
      return response._source;
    } catch (error) {
      log(`Error getting by id ${entryId} on index ${indexName}: ${errorToString(error)}`);
      return undefined;
    }
  }

  private mapResult(input: OpenSearchResponseHit<FhirSearchResult>[]): FhirSearchResult[] {
    if (!input) return [];
    return input.map(hit => {
      return {
        cxId: hit._source.cxId,
        patientId: hit._source.patientId,
        resourceType: hit._source.resourceType,
        resourceId: hit._source.resourceId,
        rawContent: hit._source.rawContent,
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
