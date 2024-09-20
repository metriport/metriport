import { Bundle, Resource } from "@medplum/fhirtypes";
import { ResourceTypeForConsolidation } from "@metriport/shared/medical";
import { out } from "../../util";
import { createConsolidatedFromConversions } from "./consolidated-create";
import { filterBundleByDate } from "./consolidated-filter-by-date";
import { filterBundleByResource } from "./consolidated-filter-by-resource";
import { getConsolidated } from "./consolidated-get";

/**
 * Get the patient's consolidated from S3 and filters the resources based on the given parameters.
 * If the consolidated bundle doesn't exist it will be created from the existing conversion
 * (CDA>FHIR) bundles.
 */
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

  const consolidated = await getOrCreateConsolidatedOnS3({ cxId, patientId });
  if (!consolidated || !consolidated.entry) {
    log(`No consolidated bundle found/created!`);
    return undefined;
  }
  consolidated.type = "searchset";

  log(`Consolidated found with ${consolidated.entry.length} entries`);
  const filtered = await filterConsolidated(consolidated, params);
  log(`Filtered to ${filtered?.entry?.length} entries`);
  return filtered;
}

async function getOrCreateConsolidatedOnS3({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<Bundle<Resource> | undefined> {
  const preGenerated = await getConsolidated({
    cxId,
    patientId,
  });
  if (preGenerated.bundle) return preGenerated.bundle;

  const newConsolidated = await createConsolidatedFromConversions({ cxId, patientId });
  return newConsolidated;
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
