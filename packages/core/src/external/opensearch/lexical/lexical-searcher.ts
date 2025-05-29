import { errorToString } from "@metriport/shared";
import { Client } from "@opensearch-project/opensearch";
import { capture, out } from "../../../util";
import {
  OpenSearchConfigDirectAccess,
  OpenSearchResponse,
  OpenSearchResponseGet,
  OpenSearchResponseHit,
} from "../index";
import { FhirSearchResult } from "../index-based-on-fhir";
import { paginatedSearch } from "../paginate";
import { getEntryId } from "../shared/id";
import { createSearchByIdsQuery } from "../shared/query";
import { createLexicalSearchQuery, createQueryHasData } from "./lexical-search";

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
    const { log } = out(`${this.constructor.name}.search - cx ${cxId}, pt ${patientId}`);

    const { indexName, endpoint, username, password } = this.config;
    const auth = { username, password };
    const client = new Client({ node: endpoint, auth });

    log(`Searching on index ${indexName}...`);
    const searchRequest = createLexicalSearchQuery({
      cxId,
      patientId,
      query,
    });

    const response = await paginatedSearch<FhirSearchResult>({
      client,
      indexName,
      searchRequest,
      mapResults,
    });

    log(`Successfully searched, got ${response.count} results`);
    return response.items;
  }

  async hasData({ cxId, patientId }: { cxId: string; patientId: string }): Promise<boolean> {
    const { log } = out(`${this.constructor.name}.hasData - cx ${cxId}, pt ${patientId}`);

    const { indexName, endpoint, username, password } = this.config;
    const auth = { username, password };
    const client = new Client({ node: endpoint, auth });

    log(`Checking if data exists on index ${indexName}...`);
    const searchRequest = createQueryHasData({ cxId, patientId });

    const response = await client.search({ index: indexName, body: searchRequest });

    const body = response.body as OpenSearchResponse<FhirSearchResult>;
    const hasData = body.hits.hits ? body.hits.hits.length > 0 : false;
    log(`Data exists: ${hasData}`);
    return hasData;
  }

  async getById(id: string): Promise<FhirSearchResult | undefined>;
  async getById({
    cxId,
    patientId,
    resourceId,
  }: GetByIdRequest): Promise<FhirSearchResult | undefined>;
  async getById(params: string | GetByIdRequest): Promise<FhirSearchResult | undefined> {
    const { log } = out(`${this.constructor.name}.getById - params ${JSON.stringify(params)}`);

    const entryId =
      typeof params === "string"
        ? params
        : getEntryId(params.cxId, params.patientId, params.resourceId);

    const { indexName, endpoint, username, password } = this.config;
    const auth = { username, password };
    const client = new Client({ node: endpoint, auth });

    try {
      const response = (
        await client.get({
          index: indexName,
          id: entryId,
        })
      ).body as OpenSearchResponseGet<FhirSearchResult>;

      if (!response.found) return undefined;
      return response._source;
    } catch (error) {
      const msg = `Error getting by ID from OpenSearch`;
      const extra = { entryId, indexName, error: errorToString(error) };
      log(`${msg} - ${JSON.stringify(extra)}`);
      capture.error(msg, { extra: { ...extra, context: this.constructor.name } });
      return undefined;
    }
  }

  async getByIds({
    cxId,
    patientId,
    ids,
  }: {
    cxId: string;
    patientId: string;
    ids: string[];
  }): Promise<FhirSearchResult[]> {
    const { log } = out(`${this.constructor.name}.getByIds - ids: ${ids.length}`);

    if (ids.length === 0) return [];

    const { indexName, endpoint, username, password } = this.config;
    const auth = { username, password };
    const client = new Client({ node: endpoint, auth });

    log(`Searching on index ${indexName}...`);
    const searchRequest = createSearchByIdsQuery({
      cxId,
      patientId,
      ids,
    });

    const response = await paginatedSearch<FhirSearchResult>({
      client,
      indexName,
      searchRequest,
      mapResults,
    });

    return response.items;
  }
}

function mapResults(input: OpenSearchResponseHit<FhirSearchResult>[]): FhirSearchResult[] {
  if (!input) return [];
  return input.map(hit => {
    const entryId = hit._id;
    const source = hit._source;
    return {
      entryId,
      cxId: source.cxId,
      patientId: source.patientId,
      resourceType: source.resourceType,
      resourceId: source.resourceId,
      rawContent: source.rawContent,
    };
  });
}
