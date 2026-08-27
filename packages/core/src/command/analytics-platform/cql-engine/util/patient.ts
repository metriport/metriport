import { Bundle } from "@medplum/fhirtypes";
import { S3Utils } from "../../../../external/aws/s3";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";

/**
 * Generate S3 key for patient bundle
 * Format: {keyPrefix}/patient_bundle.json
 */
export function generatePatientBundleKey(keyPrefix: string): string {
  return `${keyPrefix}/patient_bundle.json`;
}

export async function getPatientBundle({
  s3Params,
  cxId,
  patientId,
}: {
  s3Params?: {
    key: string;
    bucket: string;
  };
  cxId: string;
  patientId: string;
}): Promise<Bundle | undefined> {
  const { log } = out(`getPatientBundle - cx ${cxId}, patient ${patientId}`);
  const s3Utils = new S3Utils(Config.getAWSRegion());
  if (s3Params) {
    log(`Fetching patient bundle from analytics bucket: ${s3Params.bucket}/${s3Params.key}`);
    const fileContents = await s3Utils.getFileContentsAsString(s3Params.bucket, s3Params.key);
    return JSON.parse(fileContents);
  }
  log(`No patient bundle found in analytics bucket, generating from database`);
  return await getPatientBundleFromDatabase({ cxId, patientId });
}

export async function getPatientBundleFromDatabase({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<Bundle | undefined> {
  const { log } = out(`getPatientBundleFromDatabase - cx ${cxId}, patient ${patientId}`);
  // TODO ENG-1620: Implement HEDIS schema connection in CQL Transform flow
  log(`Getting patient bundle from database... not implemented yet`);
  return undefined;
}

export async function uploadPatientBundleToS3({
  patientBundle,
  bucket,
  key,
}: {
  patientBundle: Bundle;
  bucket: string;
  key: string;
}): Promise<void> {
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const content = JSON.stringify(patientBundle, null, 2);
  await s3Utils.uploadFile({
    bucket,
    key,
    file: Buffer.from(content, "utf-8"),
    contentType: "application/json",
  });
}
