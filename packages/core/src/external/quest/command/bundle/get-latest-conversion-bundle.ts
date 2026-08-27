import { Bundle, BundleEntry } from "@medplum/fhirtypes";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { executeWithRetriesS3, S3Utils } from "../../../aws/s3";
import { buildPatientLatestLabConversionFileName } from "../../file/file-names";

/**
 * Returns the bundle with Quest data for a given patient.
 *
 * @param cxId - UUID of the customer.
 * @param patientId - UUID of the patient.
 * @returns The bundle with Quest data, or undefined if no Quest data
 */
export async function getLatestConversionLabBundle({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<Bundle | undefined> {
  const { log } = out(`quest.getConsolidatedLabBundle - cx ${cxId}, pat ${patientId}`);
  const bucketName = Config.getLabConversionBucketName();
  if (!bucketName) {
    log(`No lab conversion bucket name found, skipping`);
    return undefined;
  }
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const fileName = buildPatientLatestLabConversionFileName({ cxId, patientId });
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
 * Retrieves only the bundle entries from the full Quest conversion bundle for the patient
 * (all their Quest data deduplicated into one bundle), or an empty array if no data.
 */
export async function getLatestConversionLabBundleResources({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<BundleEntry[]> {
  const bundle = await getLatestConversionLabBundle({ cxId, patientId });
  return bundle?.entry ?? [];
}
