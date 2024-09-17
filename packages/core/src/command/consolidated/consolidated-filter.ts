import { Bundle, Resource } from "@medplum/fhirtypes";
import { ResourceTypeForConsolidation } from "@metriport/shared/medical";
import { createFolderName } from "../../domain/filename";
import { S3Utils } from "../../external/aws/s3";
import { out } from "../../util";
import { Config } from "../../util/config";
import { filterBundleByDate } from "./consolidated-filter-resources";
import { getConsolidated } from "./consolidated-get";

export async function getConsolidatedFromS3({
  cxId,
  patientId,
  ...params
}: {
  cxId: string;
  patientId: string;
  documentIds?: string[] | undefined;
  resources?: ResourceTypeForConsolidation[] | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}): Promise<Bundle | undefined> {
  const { log } = out(`getConsolidatedFromS3 - cx ${cxId}, pat ${patientId}`);
  log(`Running with params: ${JSON.stringify(params)}`);

  const preGenerated = await getConsolidated({
    cxId,
    patientId,
  });
  const consolidated =
    preGenerated.bundle ?? (await generateConsolidatedFromSnapshots({ cxId, patientId }));
  if (!consolidated || !consolidated.entry || consolidated.entry.length < 1) {
    log(`No consolidated found, returning undefined`);
    return undefined;
  }

  log(`Consolidated found with ${consolidated.entry.length} entries`);
  const filtered = await filterConsolidated(consolidated, params);
  log(`Filtered to ${filtered?.entry?.length} entries`);
  return filtered;
}

// TODO 2215 Implement this
// TODO 2215 Implement this
// TODO 2215 Implement this
async function generateConsolidatedFromSnapshots({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<Bundle | undefined> {
  const { log } = out(`generateConsolidatedFromSnapshots - cx ${cxId}, pat ${patientId}`);
  const conversionBucketName = Config.getCdaToFhirConversionBucketName();
  if (!conversionBucketName) {
    log(`Tried to build consolidated from snapshots, but conversion bucket name is not set.`);
    return undefined;
  }
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const patientFolderPath = createFolderName(cxId, patientId);
  const objects = (await s3Utils.listObjects(conversionBucketName, patientFolderPath)) ?? [];
  const snapshotObjects = objects.filter(o => o.Key?.includes(".xml.json"));
  log(`Found ${objects.length} objects, ${snapshotObjects.length} snapshots`);
  if (!snapshotObjects || snapshotObjects.length < 1) return undefined;
  // Create a destination bundle
  // Merge the snapshot objects into the bundle
  // return it
  log(`Returning undefined while this is not fully implemented`);
  return undefined;
}

async function filterConsolidated(
  bundle: Bundle<Resource>,
  {
    // documentIds = [],
    // resources = [],
    dateFrom,
    dateTo,
  }: {
    documentIds?: string[] | undefined;
    resources?: ResourceTypeForConsolidation[] | undefined;
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
  }
): Promise<Bundle | undefined> {
  const { log } = out(`filterConsolidated`);
  log(`Got ${bundle.entry?.length} entries to filter...`);
  // TODO 2215 Filter by resources
  // log(`Filtered by resources to ${bundle.entry?.length} entries...`);
  // TODO 2215 Decide what to do with documentIds, might need to force consolidated from FHIR server if those are set
  const filtered = filterBundleByDate(bundle, dateFrom, dateTo);
  log(`Filtered by date to ${filtered?.entry?.length} entries, returning.`);
  return filtered;
}
