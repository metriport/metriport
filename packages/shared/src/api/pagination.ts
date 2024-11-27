export type ResponseMeta = {
  prevPage?: string | null;
  nextPage?: string | null;
  itemsOnPage: number;
  /** Indicates the total number of items in all pages; only available in the first page. */
  itemsInTotal?: number;
};

export type PaginatedResponse<T, PropertyName extends string> = { meta: ResponseMeta } & {
  [P in PropertyName]: T[];
};
