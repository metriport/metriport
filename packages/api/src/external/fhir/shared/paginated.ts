import { ExtractResource, ResourceType } from "@medplum/fhirtypes";

export const getAllPages = async <K extends ExtractResource<ResourceType>>(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  searchFunction: <W extends K>() => AsyncGenerator<K[]>
) => {
  const pages: K[] = [];
  for await (const page of searchFunction<K>()) {
    pages.push(...page);
  }
  return pages;
};

export type PaginatedFHIRRequestParams = {
  paginationId: string;
  offset: number;
  itemsPerPage?: number;
};

export type PaginatedFHIRRequest<T> = T & {
  pagination?: PaginatedFHIRRequestParams;
};

export type PaginatedFHIRResponse<T> = {
  data: T;
  pagination: {
    paginationId?: string;
    nextOffset?: number;
    previousOffset?: number;
    itemsPerPage?: number;
  };
};
