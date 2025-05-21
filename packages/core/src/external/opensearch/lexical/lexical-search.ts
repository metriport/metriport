import { contentFieldName, OpenSearchRequestBody } from "../index";
import { cleanupQuery } from "../query";
import { getPatientFilters } from "../shared/filters";

export type LexicalSearchParams = {
  query: string;
  cxId: string;
  patientId: string;
};

/**
 * Generates a lexical search query to be executed against a OpenSearch index.
 */
export function createLexicalSearchQuery({
  query,
  cxId,
  patientId,
}: LexicalSearchParams): OpenSearchRequestBody {
  const isMatchQuery = query.startsWith("$");
  const actualQuery = cleanupQuery(query);
  const generalParams = {
    _source: {
      // removes these from the response
      exclude: ["content_embedding", contentFieldName],
    },
  };
  if (isMatchQuery) {
    return {
      ...generalParams,
      query: {
        bool: {
          must: [
            ...(actualQuery.length > 0
              ? [
                  {
                    // https://docs.opensearch.org/docs/latest/query-dsl/full-text/match/
                    match: {
                      content: {
                        query: actualQuery,
                        fuzziness: "AUTO",
                      },
                    },
                  },
                ]
              : []),
            ...getPatientFilters(cxId, patientId),
          ],
        },
      },
    };
  }
  return {
    ...generalParams,
    query: {
      bool: {
        must: [
          ...(actualQuery.length > 0
            ? [
                {
                  // https://docs.opensearch.org/docs/latest/query-dsl/full-text/simple-query-string/
                  simple_query_string: {
                    query: actualQuery,
                    fields: [contentFieldName],
                  },
                },
              ]
            : []),
          ...getPatientFilters(cxId, patientId),
        ],
      },
    },
  };
}
