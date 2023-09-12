import { DocumentReference } from "@medplum/fhirtypes";
import { capture } from "../../../shared/notifications";
import { makeFhirApi } from "../api/api-factory";
import { isoDateRangeToFHIRDateQuery } from "../shared";
import { containedHasNames } from "./filter";

export const getDocuments = async ({
  cxId,
  patientId,
  dateRange: { from, to } = {},
  organizationName,
  practitionerName,
}: {
  cxId: string;
  patientId: string;
  dateRange?: { from?: string; to?: string };
  organizationName?: string;
  practitionerName?: string;
}): Promise<DocumentReference[] | undefined> => {
  const api = makeFhirApi(cxId);
  const docs: DocumentReference[] = [];
  try {
    const patientFilter = `patient=${patientId}`;
    const fhirDateFilter = isoDateRangeToFHIRDateQuery(from, to);
    const dateFilter = fhirDateFilter ? `&${fhirDateFilter}` : "";
    for await (const page of api.searchResourcePages(
      "DocumentReference",
      `${patientFilter}${dateFilter}`
    )) {
      docs.push(...page);
    }
  } catch (error) {
    const msg = `Error getting documents from FHIR server`;
    console.log(`${msg} - patientId: ${patientId}, error: ${error}`);
    capture.message(msg, { extra: { patientId, error }, level: "error" });
    throw error;
  }
  const result =
    organizationName || practitionerName
      ? docs.filter(containedHasNames({ organizationName, practitionerName }))
      : docs;
  return result;
};
