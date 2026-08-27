import { Bundle, BundleEntry, Binary } from "@medplum/fhirtypes";
import { createConsolidatedDataFilePath } from "@metriport/core/domain/consolidated/filename";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { base64ToString, getEnvVarOrFail } from "@metriport/shared";
import { parseFhirBundle } from "@metriport/shared/medical";

const region = getEnvVarOrFail("AWS_REGION");
const medicalDocsBucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const s3 = new S3Utils(region);

export async function getConsolidatedBundle(
  cxId: string,
  patientId: string
): Promise<Bundle | undefined> {
  const filePath = createConsolidatedDataFilePath(cxId, patientId);
  if (!(await s3.fileExists(medicalDocsBucketName, filePath))) {
    return undefined;
  }
  try {
    const consolidatedData = await s3.downloadFile({
      bucket: medicalDocsBucketName,
      key: createConsolidatedDataFilePath(cxId, patientId),
    });

    const bundle = parseFhirBundle(consolidatedData.toString());
    return bundle;
  } catch (error) {
    return undefined;
  }
}

export function getAiSummary(bundle: Bundle): string | undefined {
  const aiSummary = bundle.entry?.find(
    entry => entry.resource?.resourceType === "Binary"
  ) as BundleEntry<Binary>;
  if (aiSummary && aiSummary.resource?.data) {
    return base64ToString(aiSummary.resource.data);
  }
  return undefined;
}
