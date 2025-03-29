import { Bundle, BundleEntry } from "@medplum/fhirtypes";
import { parseFhirBundle } from "@metriport/shared/medical";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { CONSOLIDATED_DATA_KEY, RAW_KEY } from "../../domain/consolidated/filename";
import { createUploadDirectoryPath, createUploadFilePath } from "../../domain/document/upload";
import { Patient } from "../../domain/patient";
import { S3Utils, executeWithRetriesS3 } from "../../external/aws/s3";
import { deduplicate } from "../../external/fhir/consolidated/deduplicate";
import { hydrate } from "../../external/fhir/consolidated/hydrate";
import { normalize } from "../../external/fhir/consolidated/normalize";
import { toFHIR as patientToFhir } from "../../external/fhir/patient/conversion";
import { buildBundleEntry } from "../../external/fhir/shared/bundle";
import { executeAsynchronously, out } from "../../util";
import { Config } from "../../util/config";
import { BundleLocation, buildConsolidatedBundle, merge } from "./consolidated-create";

dayjs.extend(duration);

const bucket = Config.getMedicalDocumentsBucketName();
const s3Utils = new S3Utils(Config.getAWSRegion());

export const sentToFhirServerPrefix = "toFhirServer";

const numberOfParallelExecutions = 10;
const defaultS3RetriesConfig = {
  maxAttempts: 3,
  initialDelay: 500,
};

/**
 * Create a consolidated bundle from the existing upload bundles.
 */
export async function createConsolidatedFromUploads(patient: Patient): Promise<Bundle> {
  const { cxId, id: patientId } = patient;
  const { log } = out(`createConsolidatedFromUploads - cx ${cxId}, pat ${patientId}`);

  const fhirPatient = patientToFhir(patient);
  const patientEntry = buildBundleEntry(fhirPatient);

  const uploads = await getUploads(cxId, patientId);
  log(`Got ${uploads.length} resources from uploads`);

  const rawBundle = buildConsolidatedBundle();
  rawBundle.entry = [...uploads, patientEntry];
  rawBundle.total = rawBundle.entry.length;

  log(`Processing uploaded bundle...`);
  const deduped = await deduplicate({ cxId, patientId, bundle: rawBundle });
  const normalized = await normalize({ cxId, patientId, bundle: deduped });
  const hydrated = await hydrate({ cxId, patientId, bundle: normalized });
  log(`...done, from ${rawBundle.entry?.length} to ${hydrated.entry?.length} resources`);

  const rawConsolidatedName = createUploadFilePath(
    patient.cxId,
    patient.id,
    `${CONSOLIDATED_DATA_KEY}_${RAW_KEY}.json`
  );

  const processedConsolidatedName = createUploadFilePath(
    patient.cxId,
    patient.id,
    `${CONSOLIDATED_DATA_KEY}.json`
  );

  log(`Storing raw consolidated upload bundle on ${bucket}, key ${rawConsolidatedName}`);
  log(
    `Storing processed consolidated upload bundle on ${bucket}, key ${processedConsolidatedName}`
  );
  await Promise.all([
    s3Utils.uploadFile({
      bucket,
      key: rawConsolidatedName,
      file: Buffer.from(JSON.stringify(rawBundle)),
      contentType: "application/json",
    }),
    s3Utils.uploadFile({
      bucket,
      key: processedConsolidatedName,
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
  const uploadedObjects = objects.filter(o => o.Key?.includes(sentToFhirServerPrefix));
  log(`Found ${uploadedObjects.length} uploaded bundles`);
  const uploadedBundleLocations = uploadedObjects.flatMap(o =>
    o.Key ? { bucket, key: o.Key } : []
  );
  return uploadedBundleLocations;
}
