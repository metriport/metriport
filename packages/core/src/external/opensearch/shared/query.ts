import { contentFieldName, OpenSearchRequestBody } from "..";

export const simpleQueryStringPrefix = "$";
export const defaultExcludeFields = ["content_embedding", contentFieldName];

export type SearchByIdsParams = {
  cxId: string;
  patientId: string;
  ids: string[];
};

export function createSearchByIdsQuery({
  cxId,
  patientId,
  ids,
}: SearchByIdsParams): OpenSearchRequestBody {
  const generalParams = getGeneralParams();
  return {
    ...generalParams,
    query: {
      bool: {
        must: [{ ids: { values: ids } }, ...getPatientFilters(cxId, patientId)],
      },
    },
  };
}

/**
 * Return general OpenSearch search parameters used in all/most queries.
 *
 * @param excludeFields Fields to exclude from the response. Optional, defaults to defaultExcludeFields.
 */
export function getGeneralParams({
  excludeFields = defaultExcludeFields,
}: {
  excludeFields?: string[];
} = {}): OpenSearchRequestBody {
  return {
    _source: { exclude: excludeFields },
  };
}

export function getPatientFilters(cxId: string, patientId: string) {
  return [{ term: { cxId } }, { term: { patientId } }];
}

/**
 * Cleans up a query string by removing the additional chars used by our search implementation.
 *
 * @param query The query string to clean up.
 * @returns The cleaned up query string.
 */
export function cleanupQuery(query: string): string {
  return query.replace(new RegExp(`^\\${simpleQueryStringPrefix}\\s*`, "g"), "").trim();
}
