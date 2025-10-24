import { Bundle, Resource } from "@medplum/fhirtypes";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import {
  ResourceTypeForConsolidation,
  SearchSetBundle,
  toSearchSet,
} from "@metriport/shared/medical";
import { Patient } from "../../domain/patient";
import {
  buildBundleEntry,
  getReferencesFromResources,
  ReferenceWithIdAndType,
  replaceBundleEntries,
} from "../../external/fhir/bundle/bundle";
import { out } from "../../util";
import { createConsolidatedFromConversions } from "./consolidated-create";
import { filterBundleByDate } from "./consolidated-filter-by-date";
import { filterBundleByResource } from "./consolidated-filter-by-resource";
import { getConsolidatedFile } from "./consolidated-get";

const maxHydrationIterations = 5;

/**
 * Get the patient's consolidated from S3 and filters the resources based on the given parameters.
 * If the consolidated bundle doesn't exist it will be created from the existing conversion
 * (CDA>FHIR) bundles.
 */
export async function getConsolidatedFromS3({
  cxId,
  patient,
  ...params
}: {
  cxId: string;
  patient: Patient;
  resources?: ResourceTypeForConsolidation[] | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  useCachedAiBrief?: boolean | undefined;
}): Promise<SearchSetBundle> {
  const patientId = patient.id;
  const { log } = out(`getConsolidatedFromS3 - cx ${cxId}, pat ${patientId}`);
  log(`Running with params: ${JSON.stringify(params)}`);

  const consolidated = await getOrCreateConsolidatedOnS3({
    cxId,
    patient,
    useCachedAiBrief: params.useCachedAiBrief,
  });
  const consolidatedSearchset = toSearchSet(consolidated);

  log(`Consolidated found with ${consolidatedSearchset.entry?.length} entries`);
  const filtered = await filterConsolidated(consolidatedSearchset, params);
  log(`Filtered to ${filtered?.entry?.length} entries`);
  return filtered as SearchSetBundle;
}

async function getOrCreateConsolidatedOnS3({
  cxId,
  patient,
  useCachedAiBrief,
}: {
  cxId: string;
  patient: Patient;
  useCachedAiBrief?: boolean | undefined;
}): Promise<Bundle> {
  const patientId = patient.id;
  const { log } = out(`getOrCreateConsolidatedOnS3 - cx ${cxId}, pat ${patientId}`);
  const preGenerated = await getConsolidatedFile({
    cxId,
    patientId,
  });
  if (preGenerated.bundle) {
    log(`Found pre-generated consolidated, returning...`);
    return preGenerated.bundle;
  }
  log(`Did not found pre-generated consolidated, creating a new one...`);
  const newConsolidated = await createConsolidatedFromConversions({
    cxId,
    patient,
    useCachedAiBrief,
  });
  return newConsolidated;
}

export async function filterConsolidated(
  bundle: Bundle,
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

  const startedAtAddMissingRefs = new Date();
  const hydrated = addMissingReferencesFn(filtered, bundle, addMissingReferencesFn);
  log(
    `Hydrated missing refs, the bundle now has ${
      hydrated?.entry?.length
    } entries, returning... Took ${elapsedTimeFromNow(startedAtAddMissingRefs)}ms`
  );

  return hydrated;
}

export function addMissingReferences(
  filteredBundle: Bundle,
  originalBundle: Bundle,
  addMissingReferencesFn = addMissingReferences,
  iteration = 1
): Bundle {
  const filteredResources = (filteredBundle.entry ?? []).flatMap(e => e.resource ?? []);

  const { missingReferences } = getReferencesFromResources({
    resourcesToCheckRefs: filteredResources,
  });

  const resourcesToAdd = getResourcesFromBundle(missingReferences, originalBundle);

  const newEntries = [...(filteredBundle.entry ?? []), ...resourcesToAdd.map(buildBundleEntry)];
  const resultBundle = replaceBundleEntries(filteredBundle, newEntries);

  const { missingReferences: missingRefsFromAddedResources } = getReferencesFromResources({
    resourcesToCheckRefs: resourcesToAdd,
  });

  if (missingRefsFromAddedResources.length && iteration < maxHydrationIterations) {
    return addMissingReferencesFn(
      resultBundle,
      originalBundle,
      addMissingReferencesFn,
      iteration + 1
    );
  }
  return resultBundle;
}

function getResourcesFromBundle(
  references: ReferenceWithIdAndType[],
  originalBundle: Bundle<Resource>
): Resource[] {
  const bundleResourceIndex = new Map(
    originalBundle.entry?.map(e => [e.resource?.id, e.resource]) ?? []
  );

  const resourcesToAdd: Resource[] = [];
  for (const missingRef of references) {
    const resource = bundleResourceIndex.get(missingRef.id);
    if (resource) resourcesToAdd.push(resource);
  }
  return resourcesToAdd;
}
