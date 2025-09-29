import { Bundle, BundleEntry } from "@medplum/fhirtypes";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { S3Utils } from "../../../aws/s3";
import { buildLatestConversionFileName } from "../../file/file-names";

/**
 * Returns the bundle with Quest data for a given patient.
 *
 * @param cxId - UUID of the customer.
 * @param patientId - UUID of the patient.
 * @returns The bundle with Quest data, or undefined if no Quest data
 */
export async function getBundle({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<Bundle | undefined> {
  const { log } = out(`quest.getBundle - cx ${cxId}, pat ${patientId}`);
  const bucketName = Config.getLabConversionBucketName();
  if (!bucketName) {
    log(`No lab conversion bucket name found, skipping`);
    return undefined;
  }
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const fileName = buildLatestConversionFileName(cxId, patientId);
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

/**
 * Retrieves only the bundle entries from the full Quest conversion bundle for the patient
 * (all their Quest data deduplicated into one bundle), or an empty array if no data.
 */
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
