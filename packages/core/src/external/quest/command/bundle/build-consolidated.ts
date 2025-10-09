import { Bundle } from "@medplum/fhirtypes";
import { out, LogFunction } from "../../../../util";
import { Config } from "../../../../util/config";
import { S3Utils } from "../../../aws/s3";
import { dangerouslyDeduplicate } from "../../../fhir/consolidated/deduplicate";
import {
  buildPatientLabConversionPrefix,
  buildLatestConversionFileName,
} from "../../file/file-names";

/**
 * Deduplicates and merges all Quest response bundles for a given patient.
 * @param cxId - The ID of the care experience.
 * @param patientId - The ID of the patient.
 * @returns A consolidated bundle with all Quest lab data, or undefined if no bundles were found.
 */
export async function buildConsolidatedLabBundle({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<Bundle | undefined> {
  const { log } = out("quest.build-consolidated");
  const s3 = new S3Utils(Config.getAWSRegion());
  const labBucketName = Config.getLabConversionBucketName();
  if (!labBucketName) {
    log("No lab bucket configured");
    return undefined;
  }
  const bundles = await getAllResponseBundles({ s3, cxId, patientId, labBucketName, log });
  const latestBundle = dangerouslyMergeBundles(bundles);
  if (!latestBundle) {
    log("No merged bundle found");
    return undefined;
  }

  // Deduplicate all lab bundles and save the final result to S3.
  await dangerouslyDeduplicate({ cxId, patientId, bundle: latestBundle });
  const latestBundleName = buildLatestConversionFileName(cxId, patientId);
  const fileContent = Buffer.from(JSON.stringify(latestBundle));
  await s3.uploadFile({ bucket: labBucketName, key: latestBundleName, file: fileContent });
  log(`Saved latest lab conversion bundle ${latestBundleName} to ${labBucketName}`);
  return latestBundle;
}

/**
 * Returns all Quest response bundles for a given patient. This may contain both "backfill bundles" which contain a large number of historical entries,
 * and "notification bundles" which contain a daily update when a particular patient visits a lab testing location.
 *
 * @param s3 - The S3 client.
 * @param cxId - The ID of the care experience.
 * @param patientId - The ID of the patient.
 * @param labBucketName - The name of the lab conversion bucket.
 * @param log - The logger.
 * @returns
 */
async function getAllResponseBundles({
  s3,
  cxId,
  patientId,
  labBucketName,
  log,
}: {
  s3: S3Utils;
  cxId: string;
  patientId: string;
  labBucketName: string;
  log: LogFunction;
}): Promise<Bundle[]> {
  const files = await s3.listObjects(
    labBucketName,
    buildPatientLabConversionPrefix({ cxId, patientId })
  );
  if (files.length === 0) {
    log("No conversion bundles found");
    return [];
  }
  const bundles: Bundle[] = [];
  for (const file of files) {
    if (!file.Key) continue;
    const fileContents = await s3.getFileContentsAsString(labBucketName, file.Key);
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
  for (let i = 1; i < bundles.length; i++) {
    const mergeBundle = bundles[i];
    if (!mergeBundle) {
      continue;
    }
    if (mergeBundle.entry) {
      baseBundle.entry?.push(...mergeBundle.entry);
    }
  }
  return baseBundle;
}
