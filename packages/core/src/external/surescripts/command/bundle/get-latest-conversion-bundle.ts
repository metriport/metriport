import { Bundle, BundleEntry } from "@medplum/fhirtypes";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { executeWithRetriesS3, S3Utils } from "../../../aws/s3";
import { buildPatientLatestPharmacyConversionFileName } from "../../file/file-names";

/**
 * Returns the latest conversion bundle with Surescripts data for a given patient.
 *
 * @param cxId - UUID of the customer.
 * @param patientId - UUID of the patient.
 * @returns The bundle with Surescripts data, or undefined if no data.
 */
export async function getLatestConversionPharmacyBundle({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<Bundle | undefined> {
  const { log } = out(`ss.getLatestConversionPharmacyBundle - cx ${cxId}, pat ${patientId}`);
  const bucketName = Config.getPharmacyConversionBucketName();
  if (!bucketName) {
    log(`No pharmacy conversion bucket name found, skipping`);
    return undefined;
  }
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const fileName = buildPatientLatestPharmacyConversionFileName({ cxId, patientId });
  const fileExists = await s3Utils.fileExists(bucketName, fileName);
  if (!fileExists) {
    log(`No bundle found`);
    return undefined;
  }
  const fileContents = await executeWithRetriesS3(async () =>
    s3Utils.getFileContentsAsString(bucketName, fileName)
  );
  const bundle: Bundle = JSON.parse(fileContents);
  log(`Found bundle with ${bundle.entry?.length} entries`);
  return bundle;
}

/**
 * Retrieves only the bundle entries from the latest Surescripts conversion bundle for the patient
 * (all their Surescripts data deduplicated into one bundle), or an empty array if no data.
 */
export async function getLatestConversionPharmacyBundleResources({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<BundleEntry[]> {
  const bundle = await getLatestConversionPharmacyBundle({ cxId, patientId });
  return bundle?.entry ?? [];
}
