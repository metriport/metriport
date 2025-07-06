import { execSync } from "child_process";
import { Bundle } from "@medplum/fhirtypes";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { getEnvVarOrFail } from "@metriport/shared";
import { createConsolidatedDataFileNameWithSuffix } from "@metriport/core/domain/consolidated/filename";
import { Config } from "@metriport/core/util/config";

const medicalDocsBucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");

export async function getConsolidatedBundle(
  cxId: string,
  patientId: string
): Promise<Bundle | undefined> {
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const fileKey = createConsolidatedDataFileNameWithSuffix(cxId, patientId) + ".json";
  if (!(await s3Utils.fileExists(medicalDocsBucketName, fileKey))) {
    return undefined;
  }
  const fileContent = await s3Utils.downloadFile({ bucket: medicalDocsBucketName, key: fileKey });
  return JSON.parse(fileContent.toString());
}

function buildLatestExtractionBundleFileName(cxId: string, patientId: string): string {
  return `comprehend/${cxId}/${patientId}/latest.json`;
}

export async function getExtractionBundle(
  cxId: string,
  patientId: string
): Promise<Bundle | undefined> {
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const fileName = buildLatestExtractionBundleFileName(cxId, patientId);
  const bucketName = Config.getExtractionBucketName();
  if (!bucketName) {
    return undefined;
  }
  try {
    const fileContent = await s3Utils.downloadFile({ bucket: bucketName, key: fileName });
    return JSON.parse(fileContent.toString());
  } catch (error) {
    console.error(`Error getting conversion bundle for patient ${patientId}: ${error}`);
    return undefined;
  }
}

export async function writeConsolidatedBundlePreview(
  cxId: string,
  patientId: string,
  bundle: Bundle
): Promise<string> {
  const s3Utils = new S3Utils(Config.getAWSRegion());

  const fileName = createConsolidatedDataFileNameWithSuffix(cxId, patientId) + "-preview.json";
  const fileContent = JSON.stringify(bundle);
  await s3Utils.uploadFile({
    bucket: medicalDocsBucketName,
    key: fileName,
    file: Buffer.from(fileContent),
    contentType: "application/json",
  });
  return await s3Utils.getSignedUrl({
    bucketName: medicalDocsBucketName,
    fileName,
    durationSeconds: 60 * 30,
  });
}

export function openPreviewUrl(url: string): void {
  execSync(`open https://preview.metriport.com/?url=${encodeURIComponent(url)}`);
}
