export type IndexFields = {
  cxId: string;
  patientId: string;
  s3FileName: string;
  content: string;
};

export type SearchRequest = {
  cxId: string;
  patientId: string;
  // https://www.elastic.co/guide/en/elasticsearch/reference/8.5/query-dsl-query-string-query.html#_boolean_operators
  query: string;
};

export type SearchResult = Omit<IndexFields, "content"> & {
  entryId: string;
};

// https://github.com/opensearch-project/opensearch-js/issues/269
export type OpenSearchResponseHit = {
  _index: string;
  _id: string;
  _score: number;
  _source: Omit<IndexFields, "content">;
};
// https://github.com/opensearch-project/opensearch-js/issues/269
export type OpenSearchResponse = {
  hits: {
    hits?: OpenSearchResponseHit[];
  };
};

export type OpenSearchFileSearcherConfig = {
  region: string;
  indexName: string;
};

export interface OpenSearchFileSearcher {
  search(req: SearchRequest): Promise<SearchResult[]>;
}
