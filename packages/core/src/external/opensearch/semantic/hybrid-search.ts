import { contentFieldName } from "../index";

export type HybridSearchParams = {
  query: string;
  cxId: string;
  patientId: string;
  modelId: string;
  k?: number | undefined;
};

/**
 * Generates a hybrid search query that combines lexical and neural search with filters
 * for cxId and patientId. This ensures both search methods respect the same filtering criteria.
 */
export function createHybridSearchQuery({
  query,
  cxId,
  patientId,
  modelId,
  k = 5,
}: HybridSearchParams) {
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
    size: k,
    query: {
      hybrid: {
        queries: [
          {
            bool: {
              must: [
                {
                  // TODO eng-41 prob want to update to the format that benefits from the DSL
                  match: {
                    [contentFieldName]: {
                      query,
                    },
                  },
                },
                ...absoluteFilters,
              ],
            },
          },
          {
            bool: {
              must: [
                {
                  neural: {
                    content_embedding: {
                      query_text: query,
                      model_id: modelId,
                      k,
                    },
                  },
                },
                ...absoluteFilters,
              ],
            },
          },
        ],
      },
    },
  };
}
