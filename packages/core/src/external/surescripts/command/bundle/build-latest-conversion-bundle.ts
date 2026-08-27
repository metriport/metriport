import { Bundle } from "@medplum/fhirtypes";
import { LogFunction, out } from "../../../../util";
import { Config } from "../../../../util/config";
import { executeWithRetriesS3, S3Utils } from "../../../aws/s3";
import { dangerouslyDeduplicate } from "../../../fhir/consolidated/deduplicate";
import {
  buildPatientLatestPharmacyConversionFileName,
  buildPatientPharmacyConversionPrefix,
} from "../../file/file-names";

/**
 * Deduplicates and merges all Surescripts pharmacy response bundles for a given patient.
 * @param cxId - The ID of the customer.
 * @param patientId - The ID of the patient.
 * @returns A latest conversion bundle with all Surescripts pharmacy data, or undefined if no bundles were found.
 */
export async function buildLatestConversionPharmacyBundle({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<Bundle | undefined> {
  const { log } = out(`ss.buildLatestConversionPharmacyBundle - cx ${cxId}, pat ${patientId}`);
  const s3 = new S3Utils(Config.getAWSRegion());
  const pharmacyBucketName = Config.getPharmacyConversionBucketName();
  if (!pharmacyBucketName) {
    log("No pharmacy bucket configured");
    return undefined;
  }
  const bundles = await getAllPharmacyConversionBundles({
    s3,
    cxId,
    patientId,
    pharmacyBucketName,
    log,
  });
  const latestBundle = dangerouslyMergeBundles(bundles);
  if (!latestBundle) {
    log("No merged bundle found");
    return undefined;
  }

  // Deduplicate all pharmacy bundles and save the final result to S3.
  await dangerouslyDeduplicate({ cxId, patientId, bundle: latestBundle });
  const latestBundleName = buildPatientLatestPharmacyConversionFileName({ cxId, patientId });
  const fileContent = Buffer.from(JSON.stringify(latestBundle));
  await s3.uploadFile({ bucket: pharmacyBucketName, key: latestBundleName, file: fileContent });
  log(`Saved latest pharmacy conversion bundle ${latestBundleName} to ${pharmacyBucketName}`);

  return latestBundle;
}

/**
 * Returns all Surescripts pharmacy response bundles for a given patient. This may contain both "backfill bundles" which contain a large number of historical entries,
 * and "notification bundles" which contain a daily update when a particular patient has a pharmacy-related event.
 *
 * @param s3 - The S3 client.
 * @param cxId - The ID of the customer.
 * @param patientId - The ID of the patient.
 * @param pharmacyBucketName - The name of the pharmacy conversion bucket.
 * @param log - The logger.
 * @returns
 */
async function getAllPharmacyConversionBundles({
  s3,
  cxId,
  patientId,
  pharmacyBucketName,
  log,
}: {
  s3: S3Utils;
  cxId: string;
  patientId: string;
  pharmacyBucketName: string;
  log: LogFunction;
}): Promise<Bundle[]> {
  const files = await s3.listObjects(
    pharmacyBucketName,
    buildPatientPharmacyConversionPrefix({ cxId, patientId })
  );
  if (files.length < 1) {
    log("No conversion bundles found");
    return [];
  }
  const bundles: Bundle[] = [];
  for (const file of files) {
    if (!file.Key) continue;
    if (file.Key.includes(buildPatientLatestPharmacyConversionFileName({ cxId, patientId }))) {
      continue;
    }
    const fileContents = await executeWithRetriesS3(async () =>
      s3.getFileContentsAsString(pharmacyBucketName, file.Key as string)
    );
    const bundle = JSON.parse(fileContents) as Bundle;
    bundles.push(bundle);
  }
  log(`Found ${bundles.length} conversion bundles`);
  return bundles;
}

function dangerouslyMergeBundles(bundles: Bundle[]): Bundle | undefined {
  const baseBundle = bundles[0];
  if (!baseBundle) {
    return undefined;
  }
  if (!baseBundle.entry) {
    baseBundle.entry = [];
  }
  for (let i = 1; i < bundles.length; i++) {
    const mergeBundle = bundles[i];
    if (!mergeBundle) {
      continue;
    }
    if (mergeBundle.entry) {
      baseBundle.entry.push(...mergeBundle.entry);
    }
  }
  return baseBundle;
}
