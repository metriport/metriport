import { Bundle, BundleEntry } from "@medplum/fhirtypes";
import { parseFhirBundle } from "@metriport/shared/medical";
import { createConsolidatedDataFilePath } from "../../domain/consolidated/filename";
import { createFolderName } from "../../domain/filename";
import { Patient } from "../../domain/patient";
import { executeWithRetriesS3, S3Utils } from "../../external/aws/s3";
import { deduplicate } from "../../external/fhir/consolidated/deduplicate";
import { getDocuments as getDocumentReferences } from "../../external/fhir/document/get-documents";
import { toFHIR as patientToFhir } from "../../external/fhir/patient/conversion";
import { buildBundle, buildBundleEntry } from "../../external/fhir/shared/bundle";
import { executeAsynchronously, out } from "../../util";
import { Config } from "../../util/config";
import { getConsolidatedLocation, getConsolidatedSourceLocation } from "./consolidated-shared";
import { isAiBriefFeatureFlagEnabledForCx } from "../../external/aws/app-config";
import { summarizeFilteredBundleWithAI } from "../../command/ai-brief/ai-brief-create";
import { generateAiBriefFhirResource } from "../../command/ai-brief/ai-brief-shared";

const s3Utils = new S3Utils(Config.getAWSRegion());

export const conversionBundleSuffix = ".xml.json";
const numberOfParallelExecutions = 10;
const defaultS3RetriesConfig = {
  maxAttempts: 3,
  initialDelay: 500,
};

export type ConsolidatePatientDataCommand = {
  cxId: string;
  patient: Patient;
  destinationBucketName?: string | undefined;
  sourceBucketName?: string | undefined;
  generateAiBrief?: boolean | undefined;
};

type BundleLocation = { bucket: string; key: string };

/**
 * Create a consolidated bundle from the existing conversion bundles.
 */
export async function createConsolidatedFromConversions({
  cxId,
  patient,
  destinationBucketName = getConsolidatedLocation(),
  sourceBucketName = getConsolidatedSourceLocation(),
  generateAiBrief,
}: ConsolidatePatientDataCommand): Promise<Bundle> {
  const patientId = patient.id;
  const { log } = out(`createConsolidatedFromConversions - cx ${cxId}, pat ${patientId}`);

  const fhirPatient = patientToFhir(patient);
  const patientEntry = buildBundleEntry(fhirPatient);

  const [conversions, docRefs] = await Promise.all([
    getConversions({ cxId, patient, sourceBucketName }),
    getDocumentReferences({ cxId, patientId }),
  ]);
  log(`Got ${conversions.length} resources from conversions`);

  const withDups = buildConsolidatedBundle();
  withDups.entry = [...conversions, ...docRefs.map(buildBundleEntry), patientEntry];
  withDups.total = withDups.entry.length;
  log(
    `Added ${docRefs.length} docRefs and the Patient, to a total of ${withDups.entry.length} entries`
  );

  const isAiBriefFeatureFlagEnabled = await isAiBriefFeatureFlagEnabledForCx(cxId);

  if (isAiBriefFeatureFlagEnabled && generateAiBrief) {
    const aiBriefContent = await summarizeFilteredBundleWithAI(withDups, cxId, patientId);
    const aiBriefFhirResource = await generateAiBriefFhirResource(aiBriefContent);
    if (aiBriefFhirResource) {
      withDups.entry.push(buildBundleEntry(aiBriefFhirResource));
    }
  }

  log(`Deduplicating consolidated bundle...`);
  const deduped = deduplicate({ cxId, patientId, bundle: withDups });
  log(`...done, from ${withDups.entry?.length} to ${deduped.entry?.length} resources`);

  const dedupDestFileName = createConsolidatedDataFilePath(cxId, patientId, true);
  const withDupsDestFileName = createConsolidatedDataFilePath(cxId, patientId, false);
  log(`Storing consolidated bundle on ${destinationBucketName}, key ${dedupDestFileName}`);
  log(`Storing consolidated bundle w/ dups on ${destinationBucketName}, key ${dedupDestFileName}`);
  await Promise.all([
    s3Utils.uploadFile({
      bucket: destinationBucketName,
      key: dedupDestFileName,
      file: Buffer.from(JSON.stringify(deduped)),
      contentType: "application/json",
    }),
    s3Utils.uploadFile({
      bucket: destinationBucketName,
      key: withDupsDestFileName,
      file: Buffer.from(JSON.stringify(withDups)),
      contentType: "application/json",
    }),
  ]);

  log(`Done`);
  return deduped;
}

export function buildConsolidatedBundle(entries: BundleEntry[] = []): Bundle {
  return buildBundle({ type: "collection", entries });
}

async function getConversions({
  cxId,
  patient,
  sourceBucketName,
}: ConsolidatePatientDataCommand): Promise<BundleEntry[]> {
  const patientId = patient.id;
  const { log } = out(`mergeConversionBundles - cx ${cxId}, pat ${patientId}`);

  const conversionBundles = await listConversionBundlesFromS3({
    cxId,
    patientId,
    sourceBucketName,
    log,
  });
  if (!conversionBundles || conversionBundles.length < 1) {
    log(`No conversion bundles found.`);
    return [];
  }

  const mergedBundle = buildConsolidatedBundle();
  await executeAsynchronously(
    conversionBundles,
    async inputBundle => {
      const { bucket, key } = inputBundle;
      log(`Getting conversion bundle from bucket ${bucket}, key ${key}`);
      const contents = await executeWithRetriesS3(
        () => s3Utils.getFileContentsAsString(bucket, key),
        { ...defaultS3RetriesConfig, log }
      );
      log(`Merging bundle ${key} into the consolidated one`);
      const singleConversion = parseFhirBundle(contents);
      if (!singleConversion) {
        log(`No valid bundle found in ${bucket}/${key}, skipping`);
        return;
      }
      merge(singleConversion).into(mergedBundle);
    },
    { numberOfParallelExecutions }
  );

  return mergedBundle.entry ?? [];
}

async function listConversionBundlesFromS3({
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
