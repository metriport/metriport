import { Bundle } from "@medplum/fhirtypes";
import { out, LogFunction } from "../../../../util";
import { Config } from "../../../../util/config";
import { S3Utils } from "../../../aws/s3";
import {
  buildPatientConversionPrefix,
  buildLatestConversionBundleFileName,
} from "../../file/file-names";

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
    log("No consolidated bundle found");
    return undefined;
  }
  const latestBundleName = buildLatestConversionBundleFileName(cxId, patientId);
  const fileContent = Buffer.from(JSON.stringify(latestBundle));
  await s3.uploadFile({ bucket: labBucketName, key: latestBundleName, file: fileContent });
  log(`Saved latest lab conversion bundle ${latestBundleName} to ${labBucketName}`);
  return latestBundle;
}

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
    buildPatientConversionPrefix({ cxId, patientId })
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
