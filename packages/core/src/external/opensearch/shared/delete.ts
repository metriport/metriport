import { getPatientFilters } from "./query";

export type DeleteParams = {
  cxId: string;
  patientId: string;
};

export function createDeleteQuery({ cxId, patientId }: DeleteParams) {
  return {
    query: {
      bool: { must: getPatientFilters(cxId, patientId) },
    },
  };
}
