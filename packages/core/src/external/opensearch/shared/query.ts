import { contentFieldName, OpenSearchRequestBody } from "..";

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

export function getGeneralParams(): OpenSearchRequestBody {
  return {
    _source: {
      // removes these from the response
      exclude: ["content_embedding", contentFieldName],
    },
  };
}

export function getPatientFilters(cxId: string, patientId: string) {
  return [{ term: { cxId } }, { term: { patientId } }];
}
