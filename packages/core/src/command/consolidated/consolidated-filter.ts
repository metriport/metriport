import { Bundle, Resource } from "@medplum/fhirtypes";
import { ResourceTypeForConsolidation } from "@metriport/shared/medical";
import { createFolderName } from "../../domain/filename";
import { S3Utils } from "../../external/aws/s3";
import { out } from "../../util";
import { Config } from "../../util/config";
import { PatientDataConsolidator } from "./consolidated-create";
import { filterBundleByDate } from "./consolidated-filter-by-date";
import { filterBundleByResource } from "./consolidated-filter-by-resource";
import { getConsolidated } from "./consolidated-get";

const consolidator = new PatientDataConsolidator(
  Config.getMedicalDocumentsBucketName(),
  Config.getAWSRegion()
);
const conversionBucketName = Config.getCdaToFhirConversionBucketName();
const s3Utils = new S3Utils(Config.getAWSRegion());

export async function getConsolidatedFromS3({
  cxId,
  patientId,
  ...params
}: {
  cxId: string;
  patientId: string;
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
  consolidated.type = "searchset";

  log(`Consolidated found with ${consolidated.entry.length} entries`);
  const filtered = await filterConsolidated(consolidated, params);
  log(`Filtered to ${filtered?.entry?.length} entries`);
  return filtered;
}

async function generateConsolidatedFromSnapshots({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<Bundle | undefined> {
  const { log } = out(`generateConsolidatedFromSnapshots - cx ${cxId}, pat ${patientId}`);
  if (!conversionBucketName) {
    log(`Tried to build consolidated from snapshots, but conversion bucket name is not set.`);
    return undefined;
  }
  const patientFolderPath = createFolderName(cxId, patientId);
  const objects = (await s3Utils.listObjects(conversionBucketName, patientFolderPath)) ?? [];
  const snapshotObjects = objects.filter(o => o.Key?.includes(".xml.json"));
  log(`Found ${objects.length} objects, ${snapshotObjects.length} snapshots`);
  if (!snapshotObjects || snapshotObjects.length < 1) return undefined;

  const consolidated = await consolidator.execute({
    cxId,
    patientId,
    inputBundles: snapshotObjects.flatMap(o =>
      o.Key ? { bucket: conversionBucketName, key: o.Key } : []
    ),
  });
  return consolidated;
}

export async function filterConsolidated(
  bundle: Bundle<Resource>,
  {
    resources = [],
    dateFrom,
    dateTo,
  }: {
    resources?: ResourceTypeForConsolidation[] | undefined;
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
  }
): Promise<Bundle> {
  const { log } = out(`filterConsolidated`);
  log(`Got ${bundle.entry?.length} entries to filter...`);

  const filteredByResources = filterBundleByResource(bundle, resources);
  log(`Filtered by resources to ${filteredByResources.entry?.length} entries...`);

  const filtered = filterBundleByDate(filteredByResources, dateFrom, dateTo);
  log(
    `Filtered by date (${dateFrom} - ${dateTo}) to ${filtered?.entry?.length} entries, returning.`
  );
  return filtered;
}
