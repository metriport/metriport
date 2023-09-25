import { DocumentReference } from "@medplum/fhirtypes";
import { Config } from "../../../shared/config";
import { capture } from "../../../shared/notifications";
import { isCommonwellExtension } from "../../commonwell/extension";
import { makeFhirApi } from "../api/api-factory";
import { isoDateRangeToFHIRDateQuery } from "../shared";
import { isMetriportExtension } from "../shared/extensions/metriport";

export const getDocuments = async ({
  cxId,
  patientId,
  dateRange: { from, to } = {},
  contentFilter,
}: {
  cxId: string;
  patientId: string;
  dateRange?: { from?: string; to?: string };
  contentFilter?: string;
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
  const checkContent = (d: DocumentReference) =>
    contentFilter ? JSON.stringify(d).toLocaleLowerCase().includes(contentFilter) : true;

  const result = docs.filter(d => checkExtensions(d) && checkContent(d));

  return result;
};

function checkExtensions(doc: DocumentReference) {
  // skip this check for sandbox as we don't have extensions in the sandbox doc refs
  // to be removed in #895
  if (Config.isSandbox()) return true;
  const extensions = doc.extension;
  if (!extensions) return false;
  const metriport = extensions.find(isMetriportExtension);
  const cw = extensions.find(isCommonwellExtension);
  if (!metriport && !cw) return false;
  return true;
}
