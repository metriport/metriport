import { convertIncomingDataToFhirBundle } from "./fhir/bundle";
import { ResponseDetail } from "./schema/response";
import { IncomingData } from "./schema/shared";
import { QuestConversionBundle } from "./types";

export async function convertBatchResponseToFhirBundles(
  cxId: string,
  details: IncomingData<ResponseDetail>[]
): Promise<QuestConversionBundle[]> {
  const patientIdDetails = buildPatientIdToDetailsMap(details);
  const conversionBundles: QuestConversionBundle[] = [];
  for (const [patientId, details] of patientIdDetails.entries()) {
    if (!details || details.length < 1) continue;
    const bundle = await convertIncomingDataToFhirBundle(cxId, patientId, details);
    conversionBundles.push({
      cxId,
      patientId,
      bundle,
    });
  }
  return conversionBundles;
}

function buildPatientIdToDetailsMap(
  details: IncomingData<ResponseDetail>[]
): Map<string, IncomingData<ResponseDetail>[]> {
  const patientIdDetails = new Map<string, IncomingData<ResponseDetail>[]>();
  for (const detail of details) {
    const patientId = detail.data.patientId;
    if (!patientId) continue;
    if (!patientIdDetails.has(patientId)) {
      patientIdDetails.set(patientId, []);
    }
    patientIdDetails.get(patientId)?.push(detail);
  }
  return patientIdDetails;
}
