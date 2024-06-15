import { chunk } from "lodash";
import { Config } from "../../../util/config";
import { capture } from "../../../util/notifications";
import { makeFhirApi } from "../api/api-factory";
import { isoDateToFHIRDateQueryFrom, isoDateToFHIRDateQueryTo } from "../shared";
import { DocumentReferenceWithId, hasId } from "./document-reference";

export async function getDocuments({
  cxId,
  patientId,
  from,
  to,
  documentIds = [],
}: {
  cxId: string;
  patientId?: string | string[];
  from?: string | undefined;
  to?: string | undefined;
  documentIds?: string[];
}): Promise<DocumentReferenceWithId[]> {
  try {
    const api = makeFhirApi(cxId, Config.getFHIRServerUrl());
    const docs: DocumentReferenceWithId[] = [];
    const chunksDocIds = documentIds && documentIds.length > 0 ? chunk(documentIds, 150) : [[]];

    for (const docIds of chunksDocIds) {
      const filtersAsStr = getFilters({ patientId, documentIds: docIds, from, to });
      for await (const page of api.searchResourcePages("DocumentReference", filtersAsStr)) {
        docs.push(...page.filter(hasId));
      }
    }
    return docs;
  } catch (error) {
    const msg = `Error getting documents from FHIR server`;
    console.log(`${msg} - patientId: ${patientId}, error: ${error}`);
    capture.error(msg, { extra: { patientId, error } });
    throw error;
  }
}

export function getFilters({
  patientId: patientIdParam,
  documentIds = [],
  from,
  to,
}: {
  patientId?: string | string[] | undefined;
  documentIds?: string[];
  from?: string | undefined;
  to?: string | undefined;
} = {}) {
  const filters = new URLSearchParams();
  const patientIds = Array.isArray(patientIdParam) ? patientIdParam : [patientIdParam];
  const patientIdsFiltered = patientIds.flatMap(id =>
    id && id.trim().length > 0 ? id.trim() : []
  );
  patientIdsFiltered.length && filters.append("patient", patientIdsFiltered.join(","));
  documentIds.length && filters.append(`_id`, documentIds.join(","));
  from && filters.append("date", isoDateToFHIRDateQueryFrom(from));
  to && filters.append("date", isoDateToFHIRDateQueryTo(to));
  const filtersAsStr = filters.toString();
  return filtersAsStr;
}
