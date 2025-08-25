import { MetriportError } from "@metriport/shared";
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
  const patientMapping = await findPatientWithExternalId(externalId);
  if (!patientMapping) {
    throw new MetriportError(`Patient mapping not found for external ID`, undefined, {
      externalId,
    });
  }
  return { patientId: patientMapping.patientId, cxId: patientMapping.cxId };
}

// TODO: implement as http request to internal endpoint
async function findPatientWithExternalId(
  externalId: string
): Promise<{ patientId: string; cxId: string }> {
  return { patientId: externalId, cxId: externalId };
}
