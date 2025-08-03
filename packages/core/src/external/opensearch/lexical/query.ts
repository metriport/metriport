import { contentFieldName, OpenSearchRequestBody } from "../index";
import { FhirIndexFields } from "../index-based-on-fhir";
import {
  cleanupQuery,
  defaultExcludeFields,
  getGeneralParams,
  getPatientFilters,
  simpleQueryStringPrefix,
} from "../shared/query";

export type LexicalSearchParams = {
  query: string | undefined;
  cxId: string;
  patientId: string;
};

/**
 * Generates a lexical search query to be executed against an OpenSearch index.
 */
export function createLexicalSearchQuery({ query, cxId, patientId }: LexicalSearchParams): {
  isReturnAllResources: boolean;
  searchQuery: OpenSearchRequestBody;
} {
  const isMatchQuery = !query?.startsWith(simpleQueryStringPrefix);
  const actualQuery = cleanupQuery(query);
  const generalParams = getGeneralParams();
  const isReturnAllResources = actualQuery && actualQuery.length > 0 ? false : true;
  if (isMatchQuery) {
    return {
      isReturnAllResources,
      searchQuery: {
        ...generalParams,
        query: {
          bool: {
            must: [
              ...(isReturnAllResources
                ? []
                : [
                    {
                      // https://docs.opensearch.org/docs/latest/query-dsl/full-text/match/
                      match: {
                        [contentFieldName]: {
                          query: actualQuery,
                          ...getFuzzySettings(actualQuery),
                        },
                      },
                    },
                  ]),
              ...getPatientFilters(cxId, patientId),
            ],
          },
        },
      },
    };
  }
  return {
    isReturnAllResources,
    searchQuery: {
      ...generalParams,
      query: {
        bool: {
          must: [
            ...(isReturnAllResources
              ? []
              : [
                  {
                    // https://docs.opensearch.org/docs/latest/query-dsl/full-text/simple-query-string/
                    simple_query_string: {
                      query: actualQuery,
                      fields: [contentFieldName],
                    },
                  },
                ]),
            ...getPatientFilters(cxId, patientId),
          ],
        },
      },
    },
  };
}

export function createQueryHasData({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): OpenSearchRequestBody {
  const allConsolidatedDataFields: (keyof FhirIndexFields)[] = [
    "cxId",
    "patientId",
    "resourceType",
    "resourceId",
    "content",
  ];
  const generalParams = getGeneralParams({
    excludeFields: [...defaultExcludeFields, ...allConsolidatedDataFields],
  });
  return {
    ...generalParams,
    size: 1,
    query: {
      bool: { must: getPatientFilters(cxId, patientId) },
    },
  };
}

/**
 * @see https://docs.opensearch.org/latest/query-dsl/full-text/match/#fuzziness
 */
export function getFuzzySettings(query: string | undefined): {
  fuzziness: string;
  fuzzy_transpositions: boolean;
} {
  return {
    fuzziness: getFuzziness(query),
    /**
     * Whether to allow transpositions/character swaps.
     * - false: uses Levenshtein distance (calculated by counting the number of insertions,
     *   deletions, and substitutions required to transform one string into the other)
     * - true: uses Damerau–Levenshtein distance (same as above, but transpositions/swaps are
     *   counted as single edits)
     */
    fuzzy_transpositions: true,
  };
}

export function getFuzziness(query: string | undefined) {
  if (!query) return "AUTO";
  if (query.length < 4) return "0";
  return "1";
}
