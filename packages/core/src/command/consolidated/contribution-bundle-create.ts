import { Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";
import { parseFhirBundle } from "@metriport/shared/medical";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { FULL_CONTRIBUTION_BUNDLE_KEY, RAW_KEY } from "../../domain/consolidated/filename";
import {
  FHIR_BUNDLE_SUFFIX,
  createFullContributionBundleFilePath,
  createUploadDirectoryPath,
  createUploadFilePath,
} from "../../domain/document/upload";
import { Patient } from "../../domain/patient";
import { S3Utils, executeWithRetriesS3 } from "../../external/aws/s3";
import { deduplicate } from "../../external/fhir/consolidated/deduplicate";
import { hydrate } from "../../external/fhir/consolidated/hydrate";
import { normalize } from "../../external/fhir/consolidated/normalize";
import { toFHIR as patientToFhir } from "../../external/fhir/patient/conversion";
import { buildBundleEntry } from "../../external/fhir/shared/bundle";
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

  if (!existingBundle) {
    return await createFullContributionBundleFromPreviousUploads(patient);
  }

  return existingBundle;
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
  } catch (err) {
    log("No existing bundle found.");
    return undefined;
    // intentionally not rethrowing
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
  const uniqueEntries = deduplicateBundleEntries(uploads, log);

  const rawBundle = buildConsolidatedBundle();
  rawBundle.entry = [...uniqueEntries, patientEntry];
  rawBundle.total = rawBundle.entry.length;

  log(`Processing uploaded bundle...`);
  const deduped = await deduplicate({ cxId, patientId, bundle: rawBundle });
  const normalized = await normalize({ cxId, patientId, bundle: deduped });
  const hydrated = await hydrate({ cxId, patientId, bundle: normalized });
  log(`...done, from ${rawBundle.entry?.length} to ${hydrated.entry?.length} resources`);

  const rawContributionBundleName = createUploadFilePath(
    cxId,
    patientId,
    `${FULL_CONTRIBUTION_BUNDLE_KEY}_${RAW_KEY}${JSON_FILE_EXTENSION}`
  );
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
      file: Buffer.from(JSON.stringify(hydrated)),
      contentType: "application/json",
    }),
  ]);

  log(`Done`);
  return hydrated;
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
  await executeAsynchronously(
    uploadedBundles,
    async inputBundle => {
      const { bucket, key } = inputBundle;
      log(`Getting uploaded bundle from bucket ${bucket}, key ${key}`);
      const contents = await executeWithRetriesS3(
        () => s3Utils.getFileContentsAsString(bucket, key),
        { ...defaultS3RetriesConfig, log }
      );
      log(`Merging bundle ${key} into the consolidated one`);
      const singleUpload = parseFhirBundle(contents);
      if (!singleUpload) {
        log(`No valid bundle found in ${bucket}/${key}, skipping`);
        return;
      }
      merge(singleUpload).into(mergedBundle);
    },
    { numberOfParallelExecutions }
  );

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

/**
 * TODO: Existing limitation - the order in which resources are fetched from the uploads is random.
 * We cannot tell if which version of duplicated resources is kept.
 */
function deduplicateBundleEntries(
  uploads: BundleEntry<Resource>[],
  log: typeof console.log
): BundleEntry<Resource>[] {
  const uniqueEntries = new Map<string, BundleEntry<Resource>>();

  uploads.forEach(entry => {
    if (!entry.resource?.resourceType || !entry.resource?.id) {
      const msg = `Resource missing resourceType or ID`;
      log(msg);
      // TODO: Maybe we should report? I dont think this error is possible tbh!
      return;
    }

    const dedupKey = `${entry.resource.resourceType}${entry.resource.id}`;
    uniqueEntries.set(dedupKey, entry);
  });

  return Array.from(uniqueEntries.values());
}

export async function uploadFullContributionBundle({
  cxId,
  patientId,
  contributionBundle,
}: {
  cxId: string;
  patientId: string;
  contributionBundle: Bundle<Resource>;
}) {
  const fulContributionBundleName = createFullContributionBundleFilePath(cxId, patientId);
  s3Utils.uploadFile({
    bucket,
    key: fulContributionBundleName,
    file: Buffer.from(JSON.stringify(contributionBundle)),
    contentType: "application/json",
  });
}
