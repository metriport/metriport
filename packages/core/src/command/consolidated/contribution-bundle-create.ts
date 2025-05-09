import { Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";
import { parseFhirBundle } from "@metriport/shared/medical";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { CONTRIBUTION_BUNDLE_RAW } from "../../domain/consolidated/filename";
import { processBundle } from "../../domain/conversion/bundle-modifications/process";
import {
  FHIR_BUNDLE_SUFFIX,
  createFullContributionBundleFilePath,
  createUploadDirectoryPath,
  createUploadFilePath,
} from "../../domain/document/upload";
import { Patient } from "../../domain/patient";
import { S3Utils, executeWithRetriesS3, isNotFoundError } from "../../external/aws/s3";
import { toFHIR as patientToFhir } from "../../external/fhir/patient/conversion";
import { buildBundleEntry } from "../../external/fhir/shared/bundle";
import { deduplicateBundleEntriesByTypeAndId } from "../../fhir-deduplication/deduplicate-by-type-and-id";
import { executeAsynchronously, out } from "../../util";
import { Config } from "../../util/config";
import { JSON_FILE_EXTENSION } from "../../util/mime";
import { BundleLocation, buildConsolidatedBundle, merge } from "./consolidated-create";

dayjs.extend(duration);

const bucket = Config.getMedicalDocumentsBucketName();
const s3Utils = new S3Utils(Config.getAWSRegion());

const numberOfParallelExecutions = 10;
const defaultS3RetriesConfig = {
  maxAttempts: 3,
  initialDelay: 500,
};

export async function getFullContributionBundle(
  patient: Patient
): Promise<Bundle<Resource> | undefined> {
  const existingBundle = await getExistingFullContributionBundleSafe(patient);
  return existingBundle ?? (await createFullContributionBundleFromPreviousUploads(patient));
}

async function getExistingFullContributionBundleSafe(
  patient: Pick<Patient, "cxId" | "id">
): Promise<Bundle<Resource> | undefined> {
  const { cxId, id: patientId } = patient;
  const { log } = out(`getExistingFullContributionBundle, cx: ${cxId}, pt: ${patientId}`);

  const existingBundlePath = createFullContributionBundleFilePath(cxId, patientId);

  try {
    const objBuffer = await s3Utils.downloadFile({ bucket, key: existingBundlePath });
    const rawBuffer = objBuffer.toString();
    const bundle = parseFhirBundle(rawBuffer);
    if (!bundle) {
      log(`Not a bundle, skipping...`);
      return undefined;
    }
    log(
      `Found an existing Full Contribution Bundle with ${bundle.total} (vs ${bundle.entry?.length}) entries.`
    );
    return bundle;
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      log("No existing bundle found.");
      return undefined;
    }
    throw error;
  }
}

/**
 * Create a Full Contribution Bundle from the existing upload bundles.
 */
async function createFullContributionBundleFromPreviousUploads(
  patient: Patient
): Promise<Bundle | undefined> {
  const { cxId, id: patientId } = patient;
  const { log } = out(
    `createFullContributionBundleFromPreviousUploads - cx ${cxId}, pt ${patientId}`
  );

  const fhirPatient = patientToFhir(patient);
  const patientEntry = buildBundleEntry(fhirPatient);

  const uploads = await getUploads(cxId, patientId);
  log(`Got ${uploads.length} resources from uploads`);
  if (uploads.length === 0) {
    return undefined;
  }
  const uniqueEntries = deduplicateBundleEntriesByTypeAndId(uploads);

  const rawBundle = buildConsolidatedBundle();
  rawBundle.entry = [...uniqueEntries, patientEntry];
  rawBundle.total = rawBundle.entry.length;

  log(`Processing uploaded bundle...`);
  const processed = await processBundle({ bundle: rawBundle, cxId, patientId });
  log(`...done, from ${rawBundle.entry?.length} to ${processed.entry?.length} resources`);

  const docName = `${CONTRIBUTION_BUNDLE_RAW}${JSON_FILE_EXTENSION}`;
  const rawContributionBundleName = createUploadFilePath(cxId, patientId, docName);
  const fulContributionBundleName = createFullContributionBundleFilePath(cxId, patientId);

  log(`Storing raw contribution bundle on ${bucket}, key ${rawContributionBundleName}`);
  log(`Storing processed contribution bundle on ${bucket}, key ${fulContributionBundleName}`);
  await Promise.all([
    s3Utils.uploadFile({
      bucket,
      key: rawContributionBundleName,
      file: Buffer.from(JSON.stringify(rawBundle)),
      contentType: "application/json",
    }),
    s3Utils.uploadFile({
      bucket,
      key: fulContributionBundleName,
      file: Buffer.from(JSON.stringify(processed)),
      contentType: "application/json",
    }),
  ]);

  log(`Done`);
  return processed;
}

async function getUploads(cxId: string, patientId: string): Promise<BundleEntry[]> {
  const { log } = out(`getUploads - cx ${cxId}, pat ${patientId}`);

  const uploadedBundles = await listUploadedBundlesFromS3({
    cxId,
    patientId,
    log,
  });
  if (!uploadedBundles || uploadedBundles.length < 1) {
    log(`No uploaded bundles found.`);
    return [];
  }

  const mergedBundle = buildConsolidatedBundle();
  const retrievedBundles: Bundle[] = [];
  await executeAsynchronously(
    uploadedBundles,
    async inputBundle => {
      const contents = await executeWithRetriesS3(
        () => s3Utils.getFileContentsAsString(inputBundle.bucket, inputBundle.key),
        { ...defaultS3RetriesConfig, log }
      );
      const singleUpload = parseFhirBundle(contents);
      if (singleUpload) {
        retrievedBundles.push(singleUpload);
      }
    },
    { numberOfParallelExecutions }
  );

  for (const singleUpload of retrievedBundles) {
    merge(singleUpload).into(mergedBundle);
  }

  return mergedBundle.entry ?? [];
}

async function listUploadedBundlesFromS3({
  cxId,
  patientId,
  log,
}: {
  cxId: string;
  patientId: string;
  log: typeof console.log;
}): Promise<BundleLocation[]> {
  const uploadsFolderPath = createUploadDirectoryPath(cxId, patientId);
  const objects = (await s3Utils.listObjects(bucket, uploadsFolderPath)) ?? [];
  const uploadedObjects = objects.filter(o => o.Key?.includes(FHIR_BUNDLE_SUFFIX));
  log(`Found ${uploadedObjects.length} uploaded bundles`);
  const uploadedBundleLocations = uploadedObjects.flatMap(o =>
    o.Key ? { bucket, key: o.Key } : []
  );
  return uploadedBundleLocations;
}

export async function uploadFullContributionBundle({
  cxId,
  patientId,
  contributionBundle,
}: {
  cxId: string;
  patientId: string;
  contributionBundle: Bundle<Resource>;
}): Promise<void> {
  const fulContributionBundleName = createFullContributionBundleFilePath(cxId, patientId);
  await s3Utils.uploadFile({
    bucket,
    key: fulContributionBundleName,
    file: Buffer.from(JSON.stringify(contributionBundle)),
    contentType: "application/json",
  });
}
