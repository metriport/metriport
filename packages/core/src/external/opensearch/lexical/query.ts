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
                          fuzziness: "AUTO",
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
