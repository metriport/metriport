import { Bundle, BundleEntry } from "@medplum/fhirtypes";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { S3Utils } from "../../../aws/s3";
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
}): Promise<Bundle | undefined> {
  const { log } = out(`ss.getBundle - cx ${cxId}, pat ${patientId}`);
  const bucketName = Config.getPharmacyConversionBucketName();
  if (!bucketName) {
    log(`No pharmacy conversion bucket name found, skipping`);
    return undefined;
  }
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const fileName = buildLatestConversionBundleFileName(cxId, patientId);
  const fileExists = await s3Utils.fileExists(bucketName, fileName);
  if (!fileExists) {
    log(`No bundle found`);
    return undefined;
  }
  const fileContents = await s3Utils.getFileContentsAsString(bucketName, fileName);
  const bundle: Bundle = JSON.parse(fileContents);
  log(`Found bundle with ${bundle.entry?.length} entries`);
  return bundle;
}

export async function getBundleResources({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<BundleEntry[]> {
  const bundle = await getBundle({ cxId, patientId });
  return bundle?.entry ?? [];
}
