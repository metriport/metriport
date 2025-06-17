export const contentFieldName = "content";

export type OpenSearchConfig = {
  region: string;
  indexName: string;
};
export type OpenSearchConfigDirectAccess = OpenSearchConfig & {
  endpoint: string;
  username: string;
  password: string;
};

// https://github.com/opensearch-project/opensearch-js/issues/269
export type OpenSearchResponseHit<T> = {
  _index: string;
  _id: string;
  _score: number;
  _source: T;
};

// https://github.com/opensearch-project/opensearch-js/issues/269
export type OpenSearchResponse<T> = {
  hits: {
    hits?: OpenSearchResponseHit<T>[];
  };
};
export type OpenSearchResponseScroll<T> = {
  _scroll_id?: string;
} & OpenSearchResponse<T>;

export type OpenSearchResponseGet<T> = {
  _index: string;
  _id: string;
  found: boolean;
  _source: T;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OpenSearchRequestBody = Record<string, any>;
