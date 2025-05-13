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
  return {
    _source: {
      // removes these from the response
      exclude: ["content_embedding", contentFieldName],
    },
    // size: k,
    query: {
      bool: {
        must: [
          {
            query_string: {
              query,
              fields: [contentFieldName],
              analyze_wildcard: true,
            },
          },
          ...getPatientFilters(cxId, patientId),
        ],
      },
    },
  };
}
