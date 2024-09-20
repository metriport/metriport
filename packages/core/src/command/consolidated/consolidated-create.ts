import { Bundle } from "@medplum/fhirtypes";
import { createConsolidatedDataFilePath } from "../../domain/consolidated/filename";
import { createFolderName } from "../../domain/filename";
import { executeWithRetriesS3, S3Utils } from "../../external/aws/s3";
import { deduplicate } from "../../external/fhir/consolidated/deduplicate";
import { executeAsynchronously, out } from "../../util";
import { Config } from "../../util/config";
import { getConsolidatedLocation, getConsolidatedSourceLocation } from "./consolidated-shared";

const s3Utils = new S3Utils(Config.getAWSRegion());

const conversionBundleSuffix = ".xml.json";
const numberOfParallelExecutions = 10;
const defaultS3RetriesConfig = {
  maxAttempts: 3,
  initialDelay: 500,
};
const emptyBundle: Bundle = {
  resourceType: "Bundle",
  type: "collection",
  total: 0,
  entry: [],
};

export type ConsolidatePatientDataCommand = {
  cxId: string;
  patientId: string;
  destinationBucketName?: string;
  sourceBucketName?: string;
  logMemUsage?: () => void;
};

type BundleLocation = { bucket: string; key: string };

/**
 * Create a consolidated bundle from the existing conversion bundles.
 */
export async function createConsolidatedFromConversions({
  cxId,
  patientId,
  destinationBucketName = getConsolidatedLocation(),
  sourceBucketName = getConsolidatedSourceLocation(),
  logMemUsage,
}: ConsolidatePatientDataCommand): Promise<Bundle | undefined> {
  const { log } = out(`createConsolidatedFromConversions - cx ${cxId}, pat ${patientId}`);

  const inputBundles = await listConversionBundles({ cxId, patientId, sourceBucketName, log });
  if (!inputBundles || inputBundles.length < 1) {
    log(`No conversion bundles found.`);
    return undefined;
  }

  const consolidated = emptyBundle;

  await executeAsynchronously(
    inputBundles,
    async inputBundle => {
      const { bucket, key } = inputBundle;
      log(`Getting conversion bundle from bucket ${bucket}, key ${key}`);
      const contents = await executeWithRetriesS3(
        () => s3Utils.getFileContentsAsString(bucket, key),
        { ...defaultS3RetriesConfig, log }
      );
      log(`Merging bundle ${key} into the consolidated one`);
      const bundle = JSON.parse(contents) as Bundle;
      merge(bundle).into(consolidated);
      logMemUsage && logMemUsage();
    },
    { numberOfParallelExecutions }
  );

  log(`Deduplicating consolidated bundle...`);
  const deduped = deduplicate({ cxId, patientId, bundle: consolidated });
  log(`...done, from ${consolidated.entry?.length} to ${deduped.entry?.length} resources`);

  const destinationFileName = createConsolidatedDataFilePath(cxId, patientId);
  log(`Storing consolidated bundle on ${destinationBucketName}, key ${destinationFileName}`);
  await s3Utils.uploadFile({
    bucket: destinationBucketName,
    key: destinationFileName,
    file: Buffer.from(JSON.stringify(deduped)),
    contentType: "application/json",
  });

  log(`Done`);
  return deduped;
}

async function listConversionBundles({
  cxId,
  patientId,
  sourceBucketName,
  log,
}: {
  cxId: string;
  patientId: string;
  sourceBucketName: string | undefined;
  log: typeof console.log;
}): Promise<BundleLocation[]> {
  if (!sourceBucketName) {
    log(`Could not list conversion bundles, no source bucket name set.`);
    return [];
  }
  const folderPath = createFolderName(cxId, patientId);
  const objects = (await s3Utils.listObjects(sourceBucketName, folderPath)) ?? [];
  const conversionObjects = objects.filter(o => o.Key?.includes(conversionBundleSuffix));
  log(`Found ${conversionObjects.length} conversion bundles`);
  const conversionBundles = conversionObjects.flatMap(o =>
    o.Key ? { bucket: sourceBucketName, key: o.Key } : []
  );
  return conversionBundles;
}

export function merge(inputBundle: Bundle) {
  return {
    into: function (destination: Bundle): Bundle {
      if (!destination.entry) destination.entry = [];
      for (const entry of inputBundle.entry ?? []) {
        destination.entry.push(entry);
      }
      destination.total = destination.entry.length;
      return destination;
    },
  };
}
