import { chunk } from "lodash";
import { out } from "../../../util";
import { Config } from "../../../util/config";
import { capture } from "../../../util/notifications";
import { makeFhirApi } from "../api/api-factory";
import { isoDateToFHIRDateQueryFrom, isoDateToFHIRDateQueryTo } from "../shared";
import { DocumentReferenceWithId, hasId } from "./document-reference";

/**
 * Returns DocumentReferences based on the provided filter parameters.
 *
 * WARNING: If documentIds is undefined or has 0 elements, it will return all DocumentReferences that fit the other filter criteria.
 * If the documentIds includes one or more elements, it will only return the DocumentReferences for those IDs specified.
 *
 * @returns An array of DocumentReferences with required IDs
 */
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
  const { log } = out(`getDocuments - cx ${cxId}, pat ${patientId}`);
  const startedAt = new Date().getTime();
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
    const duration = new Date().getTime() - startedAt;
    log(`Got ${docs.length} doc refs from the FHIR server in ${duration}ms`);
    return docs;
  } catch (error) {
    const msg = `Error getting documents from FHIR server`;
    log(`${msg} - patientId: ${patientId}, error: ${error}`);
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
