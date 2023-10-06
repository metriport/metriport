import { Client } from "@opensearch-project/opensearch";
import { contentFieldName } from ".";
import {
  OpenSearchFileSearcher,
  OpenSearchFileSearcherConfig,
  OpenSearchResponse,
  SearchRequest,
  SearchResult,
} from "./file-searcher";

export type OpenSearchFileSearcherDirectConfig = OpenSearchFileSearcherConfig & {
  endpoint: string;
  username: string;
  password: string;
};

export class OpenSearchFileSearcherDirect implements OpenSearchFileSearcher {
  constructor(readonly config: OpenSearchFileSearcherDirectConfig) {}

  async search(req: SearchRequest): Promise<SearchResult[]> {
    const { indexName, endpoint, username, password } = this.config;
    const { cxId, patientId, query } = req;

    const auth = { username, password };
    const client = new Client({ node: endpoint, auth });

    console.log(`Searching on index ${indexName}...`);
    const queryPayload = {
      query: {
        bool: {
          must: [
            {
              query_string: {
                query,
                fields: ["content"],
                analyze_wildcard: true,
              },
            },
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
    ).body as OpenSearchResponse;
    console.log(`Successfully searched, response: ${JSON.stringify(response)}`);

    return this.mapResult(response);
  }

  private mapResult(input: OpenSearchResponse): SearchResult[] {
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
