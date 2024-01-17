import { DocumentReference } from "@medplum/fhirtypes";
import { chunk } from "lodash";
import { capture } from "../../../util/notifications";
import { makeFhirApi } from "../api/api-factory";
import { isoDateToFHIRDateQueryFrom, isoDateToFHIRDateQueryTo } from "../shared";
import { Config } from "../../../util/config";

export async function getDocuments({
  cxId,
  patientId,
  from,
  to,
  documentIds = [],
}: {
  cxId: string;
  patientId: string;
  from?: string | undefined;
  to?: string | undefined;
  documentIds?: string[];
}): Promise<DocumentReference[]> {
  try {
    const api = makeFhirApi(cxId, Config.getFHIRServerUrl());
    const docs: DocumentReference[] = [];
    const chunksDocIds = chunk(documentIds, 150);

    for (const docIds of chunksDocIds) {
      const filtersAsStr = getFilters({ patientId, documentIds: docIds, from, to });
      for await (const page of api.searchResourcePages("DocumentReference", filtersAsStr)) {
        docs.push(...page);
      }
    }
    return docs;
  } catch (error) {
    const msg = `Error getting documents from FHIR server`;
    console.log(`${msg} - patientId: ${patientId}, error: ${error}`);
    capture.message(msg, { extra: { patientId, error }, level: "error" });
    throw error;
  }
}

export function getFilters({
  patientId,
  documentIds = [],
  from,
  to,
}: {
  patientId?: string;
  documentIds?: string[];
  from?: string | undefined;
  to?: string | undefined;
} = {}) {
  const filters = new URLSearchParams();
  patientId && filters.append("patient", patientId);
  documentIds.length && filters.append(`_ids`, documentIds.join(","));
  from && filters.append("date", isoDateToFHIRDateQueryFrom(from));
  to && filters.append("date", isoDateToFHIRDateQueryTo(to));
  const filtersAsStr = filters.toString();
  return filtersAsStr;
}
