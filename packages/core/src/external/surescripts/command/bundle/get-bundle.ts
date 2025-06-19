import { Bundle, BundleEntry } from "@medplum/fhirtypes";
import { Config } from "../../../../util/config";
import { S3Utils } from "../../../aws/s3";
import { buildCollectionBundle } from "../../../fhir/bundle/bundle";
import { buildLatestConversionBundleFileName } from "../../file/file-names";

/**
 * Returns the bundle with Surescripts data for a given patient.
 *
 * @param cxId - The ID of the care experience.
 * @param patientId - The ID of the patient.
 * @returns The bundle with Surescripts data.
 */
export async function getBundle({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<Bundle> {
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const bucketName = Config.getPharmacyConversionBucketName();
  const fileName = buildLatestConversionBundleFileName(cxId, patientId);
  const fileExists = await s3Utils.fileExists(bucketName, fileName);
  if (!fileExists) return buildCollectionBundle([]);
  const fileContents = await s3Utils.getFileContentsAsString(bucketName, fileName);
  return JSON.parse(fileContents);
}

export async function getBundleResources({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<BundleEntry[]> {
  const bundle = await getBundle({ cxId, patientId });
  return bundle.entry ?? [];
}
