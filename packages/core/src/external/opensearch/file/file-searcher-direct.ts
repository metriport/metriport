import { Client } from "@opensearch-project/opensearch";
import { contentFieldName, OpenSearchConfigDirectAccess, OpenSearchResponse } from "..";
import { out } from "../../../util";
import { SearchResult } from "../index-based-on-file";
import { cleanupQuery } from "../shared/query";
import { OpenSearchFileSearcher, SearchRequest } from "./file-searcher";

export type OpenSearchFileSearcherDirectConfig = OpenSearchConfigDirectAccess;

export class OpenSearchFileSearcherDirect implements OpenSearchFileSearcher {
  constructor(readonly config: OpenSearchFileSearcherDirectConfig) {}

  async search(req: SearchRequest): Promise<SearchResult[]> {
    const { indexName, endpoint, username, password } = this.config;
    const { cxId, patientId, query } = req;
    const { debug } = out(`OSFileSearcher.search - pt ${patientId}`);

    const auth = { username, password };
    const client = new Client({ node: endpoint, auth });

    debug(`Searching on index ${indexName}...`);
    const actualQuery = cleanupQuery(query);
    const queryPayload = {
      size: 1_000,
      query: {
        bool: {
          must: [
            ...(actualQuery.length > 0
              ? [
                  {
                    // https://docs.opensearch.org/docs/latest/query-dsl/full-text/simple-query-string/
                    simple_query_string: {
                      query: actualQuery,
                      fields: ["content"],
                      analyze_wildcard: true,
                    },
                  },
                ]
              : []),
            { match: { cxId } },
            { match: { patientId } },
          ],
        },
      },
    };
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
    ).body as OpenSearchResponse<SearchResult>;
    debug(`Successfully searched, response: `, () => JSON.stringify(response));

    return this.mapResult(response);
  }

  private mapResult(input: OpenSearchResponse<SearchResult>): SearchResult[] {
    if (!input.hits || !input.hits.hits) return [];
    return input.hits.hits.map(hit => {
      return {
        entryId: hit._id,
        cxId: hit._source.cxId,
        patientId: hit._source.patientId,
        s3FileName: hit._source.s3FileName,
      };
    });
  }
}
