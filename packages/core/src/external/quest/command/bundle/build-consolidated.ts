import { Bundle } from "@medplum/fhirtypes";
import { out, LogFunction } from "../../../../util";
import { Config } from "../../../../util/config";
import { S3Utils } from "../../../aws/s3";
import { buildPatientConversionPrefix } from "../../file/file-names";

export async function buildConsolidatedLabBundle({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<Bundle | undefined> {
  const { log } = out("quest.build-consolidated");
  const s3 = new S3Utils(Config.getAWSRegion());
  const bundles = await getAllResponseBundles({ s3, cxId, patientId, log });
  const consolidatedConversionBundle = dangerouslyMergeBundles(bundles);
  if (!consolidatedConversionBundle) {
    log("No consolidated bundle found");
    return undefined;
  }
  return consolidatedConversionBundle;
}

async function getAllResponseBundles({
  s3,
  cxId,
  patientId,
  log,
}: {
  s3: S3Utils;
  cxId: string;
  patientId: string;
  log: LogFunction;
}): Promise<Bundle[]> {
  const labBucketName = Config.getLabConversionBucketName();
  if (!labBucketName) {
    log("No lab bucket configured");
    return [];
  }
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
