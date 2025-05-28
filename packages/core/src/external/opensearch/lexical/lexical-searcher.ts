import { errorToString } from "@metriport/shared";
import { Client } from "@opensearch-project/opensearch";
import { capture, out } from "../../../util";
import {
  OpenSearchConfigDirectAccess,
  OpenSearchResponseGet,
  OpenSearchResponseHit,
} from "../index";
import { FhirSearchResult } from "../index-based-on-fhir";
import { paginatedSearch } from "../paginate";
import { getEntryId } from "../shared/id";
import { createSearchByIdsQuery } from "../shared/query";
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
    return {
      entryId: hit._id,
      cxId: hit._source.cxId,
      patientId: hit._source.patientId,
      resourceType: hit._source.resourceType,
      resourceId: hit._source.resourceId,
      rawContent: hit._source.rawContent,
    };
  });
}
