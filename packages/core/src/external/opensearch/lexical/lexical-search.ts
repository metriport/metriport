import { contentFieldName } from "../index";

export type LexicalSearchParams = {
  query: string;
  cxId: string;
  patientId: string;
};

/**
 * Generates a lexical search query to be executed against a OpenSearch index.
 */
export function createLexicalSearchQuery({ query, cxId, patientId }: LexicalSearchParams) {
  const absoluteFilters = [
    {
      term: { cxId },
    },
    {
      term: { patientId },
    },
  ];
  return {
    _source: {
      // removes these from the response
      exclude: ["content_embedding", contentFieldName],
    },
    // size: k,
    query: {
      query: {
        bool: {
          must: [
            {
              query_string: {
                query,
                fields: ["content"],
                analyze_wildcard: true,
              },
            },
            ...absoluteFilters,
          ],
        },
      },
    },
  };
}
