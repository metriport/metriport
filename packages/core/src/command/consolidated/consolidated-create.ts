import { Bundle, BundleEntry } from "@medplum/fhirtypes";
import { errorToString } from "@metriport/shared";
import { parseFhirBundle } from "@metriport/shared/medical";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { generateAiBriefBundleEntry } from "../../domain/ai-brief/generate";
import { createConsolidatedDataFilePath } from "../../domain/consolidated/filename";
import { createFolderName } from "../../domain/filename";
import { Patient } from "../../domain/patient";
import { executeWithRetriesS3, S3Utils } from "../../external/aws/s3";
import { dangerouslyDeduplicate } from "../../external/fhir/consolidated/deduplicate";
import { getDocuments as getDocumentReferences } from "../../external/fhir/document/get-documents";
import { toFHIR as patientToFhir } from "../../external/fhir/patient/conversion";
import { buildBundleEntry, buildCollectionBundle } from "../../external/fhir/bundle/bundle";
import { insertSourceDocumentToAllDocRefMeta } from "../../external/fhir/shared/meta";
import { capture, executeAsynchronously, out } from "../../util";
import { Config } from "../../util/config";
import { processAsyncError } from "../../util/error/shared";
import { controlDuration } from "../../util/race-control";
import { AiBriefControls } from "../ai-brief/shared";
import { isAiBriefFeatureFlagEnabledForCx } from "../feature-flags/domain-ffs";
import { getConsolidatedLocation, getConsolidatedSourceLocation } from "./consolidated-shared";
import { makeIngestConsolidated } from "./search/fhir-resource/ingest-consolidated-factory";

dayjs.extend(duration);

const AI_BRIEF_TIMEOUT = dayjs.duration(2, "minutes");
const s3Utils = new S3Utils(Config.getAWSRegion());
const TIMED_OUT = Symbol("TIMED_OUT");

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
}: ConsolidatePatientDataCommand): Promise<Bundle> {
  const patientId = patient.id;
  const { log } = out(`createConsolidatedFromConversions - cx ${cxId}, pat ${patientId}`);

  const fhirPatient = patientToFhir(patient);
  const patientEntry = buildBundleEntry(fhirPatient);

  const [conversions, docRefs, isAiBriefFeatureFlagEnabled] = await Promise.all([
    getConversions({ cxId, patient, sourceBucketName }),
    getDocumentReferences({ cxId, patientId }),
    isAiBriefFeatureFlagEnabledForCx(cxId),
  ]);
  log(`Got ${conversions.length} resources from conversions`);

  const bundle = buildCollectionBundle();
  const docRefsWithUpdatedMeta = insertSourceDocumentToAllDocRefMeta(docRefs);
  bundle.entry = [...conversions, ...docRefsWithUpdatedMeta.map(buildBundleEntry), patientEntry];
  bundle.total = bundle.entry.length;
  log(
    `Added ${docRefsWithUpdatedMeta.length} docRefs and the Patient, to a total of ${bundle.entry.length} entries`
  );
  const lengthWithDups = bundle.entry.length;

  const withDupsDestFileName = createConsolidatedDataFilePath(cxId, patientId, false);
  log(
    `Storing consolidated bundle w/ dups on ${destinationBucketName}, key ${withDupsDestFileName}`
  );
  try {
    await s3Utils.uploadFile({
      bucket: destinationBucketName,
      key: withDupsDestFileName,
      file: Buffer.from(JSON.stringify(bundle)),
      contentType: "application/json",
    });
  } catch (e) {
    log(
      `Error uploading consolidated bundle to ${destinationBucketName}, key ${withDupsDestFileName}`
    );
    log(errorToString(e));
  }

  // TODO(ENG-328): Before continuing to make changes to this command and duplicative operations,
  // I recommend you write a unit test to verify the sequencing of these mutative operations
  log(`Deduplicating consolidated bundle...`);
  await dangerouslyDeduplicate({ cxId, patientId, bundle });
  log(`...done, from ${lengthWithDups} to ${bundle.entry?.length} resources`);

  // TODO This whole section with AI-related logic should be moved to the `generateAiBriefBundleEntry`.
  log(`isAiBriefFeatureFlagEnabled: ${isAiBriefFeatureFlagEnabled}`);
  if (isAiBriefFeatureFlagEnabled && bundle.entry && bundle.entry.length > 0) {
    const aiBriefControls: AiBriefControls = {
      cancelled: false,
    };
    const binaryBundleEntry = await Promise.race([
      generateAiBriefBundleEntry(bundle, cxId, patientId, log, aiBriefControls),
      controlDuration(AI_BRIEF_TIMEOUT.asMilliseconds(), TIMED_OUT),
    ]);

    if (binaryBundleEntry === TIMED_OUT) {
      aiBriefControls.cancelled = true;
      log(`AI Brief generation timed out after ${AI_BRIEF_TIMEOUT.asMinutes()} minutes`);
      capture.message("AI Brief generation timed out", {
        extra: { cxId, patientId, timeoutMinutes: AI_BRIEF_TIMEOUT.asMinutes() },
        level: "warning",
      });
    } else if (binaryBundleEntry) {
      bundle.entry?.push(binaryBundleEntry);
    }
  }

  const dedupDestFileName = createConsolidatedDataFilePath(cxId, patientId, true);
  log(`Storing consolidated bundle on ${destinationBucketName}, key ${dedupDestFileName}`);
  await s3Utils.uploadFile({
    bucket: destinationBucketName,
    key: dedupDestFileName,
    file: Buffer.from(JSON.stringify(bundle)),
    contentType: "application/json",
  });

  try {
    const ingestor = makeIngestConsolidated();
    await ingestor.ingestConsolidatedIntoSearchEngine({ cxId, patientId });
  } catch (error) {
    // intentionally not re-throwing
    processAsyncError("createConsolidatedFromConversions.ingestConsolidatedIntoSearchEngine")(
      error
    );
  }

  log(`Done`);
  return bundle;
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

  const mergedBundle = buildCollectionBundle();
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
