import { Bundle } from "@medplum/fhirtypes";
import { convertTabularDataToFhirBundle } from "./fhir/bundle";
import { parseResponseFile } from "./file/file-parser";

export async function convertSourceDocumentToFhirBundle(
  externalId: string,
  sourceDocument: Buffer
): Promise<Bundle> {
  const { patientId, cxId } = await getPatientFromQuestExternalId(externalId);
  const rows = parseResponseFile(sourceDocument);
  const bundle = convertTabularDataToFhirBundle({ cxId, patientId, rows });
  return bundle;
}

async function getPatientFromQuestExternalId(
  externalId: string
): Promise<{ patientId: string; cxId: string }> {
  // TODO: implement reverse lookup for external ID
  return { patientId: externalId, cxId: externalId };
}
