import { Client } from "@opensearch-project/opensearch/.";

export type IndexFields = {
  cxId: string;
  patientId: string;
  s3FileName: string;
  content: string;
};

export type IngestRequest = Omit<IndexFields, "content"> & {
  entryId: string;
  s3BucketName: string;
  requestId?: string;
};

export type SearchRequest = {
  // https://www.elastic.co/guide/en/elasticsearch/reference/8.5/query-dsl-query-string-query.html#_boolean_operators
  query: string;
};

export type SearchResult = Omit<IndexFields, "content"> & {
  entryId: string;
};

// https://github.com/opensearch-project/opensearch-js/issues/269
type OpenSearchResponseHit = {
  _index: string;
  _id: string;
  _score: number;
  _source: Omit<IndexFields, "content">;
};
// https://github.com/opensearch-project/opensearch-js/issues/269
type OpenSearchResponse = {
  hits: {
    hits: OpenSearchResponseHit[];
  };
};

export type FileSearchConnectorConfig = {
  endpoint: string;
  username: string;
  password: string;
  region: string;
  indexName: string;
};

export abstract class FileSearchConnector {
  protected contentFieldName = "content";

  constructor(readonly config: FileSearchConnectorConfig) {}

  abstract ingest(req: IngestRequest): Promise<void>;

  isIngestible(file: { contentType?: string }) {
    const ingestibleTypes = ["xml", "text", "txt", "html", "htm"];
    return ingestibleTypes.some(
      contentType => file.contentType && file.contentType.toLowerCase().includes(contentType)
    );
  }

  async search(req: SearchRequest): Promise<SearchResult[]> {
    const endpoint = this.config.endpoint;
    const username = this.config.username;
    const password = this.config.password;
    const indexName = this.config.indexName;

    const auth = { username, password };
    const client = new Client({ node: endpoint, auth });

    console.log(`Searching on index ${indexName}...`);
    const query = {
      query: {
        query_string: {
          query: req.query,
          fields: [this.contentFieldName],
          analyze_wildcard: true,
        },
      },
    };
    const response = (
      await client.search(
        {
          index: indexName,
          body: query,
        },
        {
          querystring: {
            // removes the "content" from the response
            filter_path: `-hits.hits._source.${this.contentFieldName}`,
          },
        }
      )
    ).body as OpenSearchResponse;
    console.log(`Successfully searched, response: ${JSON.stringify(response)}`);

    return this.mapResult(response);
  }

  private mapResult(input: OpenSearchResponse): SearchResult[] {
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
