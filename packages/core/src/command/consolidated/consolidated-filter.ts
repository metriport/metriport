import { Bundle, Resource } from "@medplum/fhirtypes";
import { ResourceTypeForConsolidation, SearchSetBundle } from "@metriport/shared/medical";
import { getDocuments } from "../../external/fhir/document/get-documents";
import {
  buildBundleEntry,
  getReferencesFromResources,
  ReferenceWithIdAndType,
} from "../../external/fhir/shared/bundle";
import { out } from "../../util";
import { createConsolidatedFromConversions } from "./consolidated-create";
import { filterBundleByDate } from "./consolidated-filter-by-date";
import { filterBundleByResource } from "./consolidated-filter-by-resource";
import { getConsolidated } from "./consolidated-get";

const maxHydrationIterations = 5;

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
}): Promise<SearchSetBundle> {
  const { log } = out(`getConsolidatedFromS3 - cx ${cxId}, pat ${patientId}`);
  log(`Running with params: ${JSON.stringify(params)}`);

  const consolidated = await getOrCreateConsolidatedOnS3({ cxId, patientId });
  log(`Consolidated with ${consolidated.entry?.length} entries`);

  const filtered = await filterConsolidated(consolidated, params);

  return { ...filtered, type: "searchset", entry: filtered.entry ?? [] };
}

async function getOrCreateConsolidatedOnS3({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<Bundle> {
  const { log } = out(`getOrCreateConsolidatedOnS3 - cx ${cxId}, pat ${patientId}`);

  const preGenerated = await getConsolidated({
    cxId,
    patientId,
  });
  if (preGenerated.bundle) return preGenerated.bundle;

  const [consolidated, docRefs] = await Promise.all([
    createConsolidatedFromConversions({ cxId, patientId }),
    getDocuments({
      cxId,
      patientId,
    }),
  ]);
  consolidated.entry = consolidated.entry ?? [];
  log(`Consolidated created with ${consolidated.entry.length} entries`);
  consolidated.entry.push(...docRefs.map(buildBundleEntry));
  consolidated.total = consolidated.entry.length;
  log(`Added ${docRefs.length} docRefs, to a total of ${consolidated.entry.length} entries`);
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
  },
  addMissingReferencesFn = addMissingReferences
): Promise<Bundle> {
  const { log } = out(`filterConsolidated`);
  log(`Got ${bundle.entry?.length} entries to filter...`);

  const filteredByResources = filterBundleByResource(bundle, resources);
  log(`Filtered by resources to ${filteredByResources.entry?.length} entries...`);

  const filtered = filterBundleByDate(filteredByResources, dateFrom, dateTo);
  log(
    `Filtered by date (${dateFrom} - ${dateTo}) to ${filtered?.entry?.length} entries, checking missing refs...`
  );

  const hydrated = addMissingReferencesFn(filtered, bundle, addMissingReferencesFn);
  log(`Hydrated missing refs, the bundle now has ${hydrated?.entry?.length} entries, returning.`);

  return hydrated;
}

export function addMissingReferences(
  filteredBundle: Bundle<Resource>,
  originalBundle: Bundle<Resource>,
  addMissingReferencesFn = addMissingReferences,
  iteration = 1
): Bundle<Resource> {
  const filteredResources = (filteredBundle.entry ?? []).flatMap(e => e.resource ?? []);

  const { missingReferences } = getReferencesFromResources({ resources: filteredResources });

  const resourcesToAdd = getResourcesFromBundle(missingReferences, originalBundle);

  const resultBundle = {
    ...filteredBundle,
    entry: [...(filteredBundle.entry ?? []), ...resourcesToAdd.map(buildBundleEntry)],
  };

  const { missingReferences: missingRefsFromAddedResources } = getReferencesFromResources({
    resources: resourcesToAdd,
  });

  if (missingRefsFromAddedResources.length && iteration < maxHydrationIterations) {
    return addMissingReferencesFn(
      resultBundle,
      originalBundle,
      addMissingReferencesFn,
      ++iteration
    );
  }
  return resultBundle;
}

function getResourcesFromBundle(
  references: ReferenceWithIdAndType[],
  originalBundle: Bundle<Resource>
): Resource[] {
  const resourcesToAdd: Resource[] = [];
  for (const missingRef of references) {
    const resource = originalBundle.entry?.find(e => e.resource?.id === missingRef.id)?.resource;
    if (resource) resourcesToAdd.push(resource);
  }
  return resourcesToAdd;
}
