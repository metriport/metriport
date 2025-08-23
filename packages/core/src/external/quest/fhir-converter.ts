import { MetriportError } from "@metriport/shared";
import { Bundle } from "@medplum/fhirtypes";
import { convertTabularDataToFhirBundle } from "./fhir/bundle";
import { parseResponseFile } from "./file/file-parser";
import { findPatientWithExternalId } from "@metriport/api/command/mapping/patient";
import { questSource } from "@metriport/shared/interface/external/quest/source";

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
  const patientMapping = await findPatientWithExternalId({ externalId, source: questSource });
  if (!patientMapping) {
    throw new MetriportError(`Patient mapping not found for external ID`, undefined, {
      externalId,
    });
  }
  return { patientId: patientMapping.patientId, cxId: patientMapping.cxId };
}
