import { Bundle, Resource } from "@medplum/fhirtypes";
import { ResourceTypeForConsolidation } from "@metriport/shared/medical";
import { createFolderName } from "../../domain/filename";
import { S3Utils } from "../../external/aws/s3";
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
  console.log(cxId, patientId, params);

  const preGenerated = await getConsolidated({
    cxId,
    patientId,
  });
  const consolidated =
    preGenerated.bundle ?? (await generateConsolidatedFromSnapshots({ cxId, patientId }));
  if (!consolidated) return undefined;

  const filtered = await filterConsolidated(consolidated, params);
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
  const conversionBucketName = Config.getCdaToFhirConversionBucketName();
  if (!conversionBucketName) return undefined;
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const patientFolderPath = createFolderName(cxId, patientId);
  const objects = (await s3Utils.listObjects(conversionBucketName, patientFolderPath)) ?? [];
  const snapshotObjects = objects.filter(o => o.Key?.includes(".xml.json"));
  if (!snapshotObjects || snapshotObjects.length < 1) return undefined;
  // Create a destination bundle
  // Merge the snapshot objects into the bundle
  // return it
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
  if (!bundle) return undefined;
  // TODO 2215 Filter by resources
  // TODO 2215 Decide what to do with documentIds, might need to force consolidated from FHIR server if those are set
  const filtered = filterBundleByDate(bundle, dateFrom, dateTo);
  return filtered;
}
