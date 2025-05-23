import { SearchResult } from "../index-based-on-file";

export type SearchRequest = {
  cxId: string;
  patientId: string;
  // https://www.elastic.co/guide/en/elasticsearch/reference/8.5/query-dsl-query-string-query.html#_boolean_operators
  query: string;
};

export interface OpenSearchFileSearcher {
  search(req: SearchRequest): Promise<SearchResult[]>;
}
