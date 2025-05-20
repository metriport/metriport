import { contentFieldName } from "../index";
import { getPatientFilters } from "../shared/filters";

export type LexicalSearchParams = {
  query: string;
  cxId: string;
  patientId: string;
};

/**
 * Generates a lexical search query to be executed against a OpenSearch index.
 */
export function createLexicalSearchQuery({ query, cxId, patientId }: LexicalSearchParams) {
  const isMatchQuery = query.startsWith("$");
  const actualQuery = query.replace(new RegExp(`^\\$\\s*`, "g"), "");
  if (isMatchQuery) {
    return {
      _source: {
        // removes these from the response
        exclude: ["content_embedding", contentFieldName],
      },
      query: {
        bool: {
          must: [
            {
              // https://docs.opensearch.org/docs/latest/query-dsl/full-text/match/
              match: {
                content: {
                  query: actualQuery,
                  fuzziness: "AUTO",
                },
              },
            },
            ...getPatientFilters(cxId, patientId),
          ],
        },
      },
    };
  }
  return {
    _source: {
      // removes these from the response
      exclude: ["content_embedding", contentFieldName],
    },
    query: {
      bool: {
        must: [
          {
            // https://docs.opensearch.org/docs/latest/query-dsl/full-text/simple-query-string/
            simple_query_string: {
              query: actualQuery,
              fields: [contentFieldName],
            },
          },
          ...getPatientFilters(cxId, patientId),
        ],
      },
    },
  };
}
