export type ResponseMeta = {
  prevPage?: string | null;
  nextPage?: string | null;
  itemsOnPage: number;
};

export type PaginatedResponse<T, PropertyName extends string> = { meta: ResponseMeta } & {
  [P in PropertyName]: T[];
};
