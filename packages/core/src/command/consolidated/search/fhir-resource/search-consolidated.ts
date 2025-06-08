import { Resource, ResourceType } from "@medplum/fhirtypes";
import { errorToString } from "@metriport/shared";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { SearchSetBundle } from "@metriport/shared/medical";
import { timed } from "@metriport/shared/util/duration";
import { chunk, Dictionary, groupBy, uniq } from "lodash";
import { Patient } from "../../../../domain/patient";
import {
  buildBundleEntry,
  buildSearchSetBundle,
  getReferencesFromResources,
  ReferenceWithIdAndType,
} from "../../../../external/fhir/bundle/bundle";
import { toFHIR as patientToFhir } from "../../../../external/fhir/patient/conversion";
import { isMedication } from "../../../../external/fhir/shared";
import {
  FhirSearchResult,
  rawContentFieldName,
} from "../../../../external/opensearch/index-based-on-fhir";
import { OpenSearchFhirSearcher } from "../../../../external/opensearch/lexical/fhir-searcher";
import { getEntryId } from "../../../../external/opensearch/shared/id";
import { simpleQueryStringPrefix } from "../../../../external/opensearch/shared/query";
import { executeAsynchronously, out } from "../../../../util";
import { searchDocuments } from "../document-reference/search";
import { getConfigs } from "./fhir-config";

const maxHydrationAttempts = 5;
const maxIdsPerQuery = 500; // Keep search query under 32KB

const medRelatedResourceTypes: ResourceType[] = [
  "MedicationRequest",
  "MedicationDispense",
  "MedicationAdministration",
  "MedicationStatement",
];

export type SearchConsolidatedParams = {
  patient: Patient;
  query: string | undefined;
};

export type SearchConsolidatedResult = {
  url?: string;
  resourceCount: number;
};

export interface SearchConsolidated {
  search({ patient, query }: SearchConsolidatedParams): Promise<SearchConsolidatedResult>;
}

/**
 * Performs a search on a patient's consolidated resources in OpenSearch/OS
 * and returns the resources stored in the OS results.
 *
 * @param patient The patient to search.
 * @param query The query to search for. If undefined or empty string, all resources will be returned.
 * @returns The search results.
 */
export async function searchPatientConsolidated({
  patient,
  query,
}: {
  patient: Patient;
  query: string | undefined;
}): Promise<SearchSetBundle> {
  const { log } = out(`searchPatientConsolidated - cx ${patient.cxId}, pt ${patient.id}`);

  log(`Searching OS...`);
  const startedAt = new Date();

  const searchConsolidatedDataPromise = async () => {
    const { isReturnAllResources, results } = await searchConsolidatedData({
      cxId: patient.cxId,
      patientId: patient.id,
      query,
    });
    const resultsAsResources = fhirSearchResultToResources(results, log);
    return { isReturnAllResources, results: resultsAsResources };
  };

  const searchDocumentsPromise = () =>
    searchDocuments({ cxId: patient.cxId, patientId: patient.id, contentFilter: query });

  const [searchConsolidatedDataResult, docRefResults] = await Promise.all([
    timed(searchConsolidatedDataPromise, "searchConsolidatedData", log),
    timed(searchDocumentsPromise, "searchDocuments", log),
  ]);

  const { isReturnAllResources: isReturnAllConsolidatedData, results: consolidatedDataResults } =
    searchConsolidatedDataResult;

  log(
    `Got ${consolidatedDataResults.length} resources and ${
      docRefResults.length
    } DocRefs in ${elapsedTimeFromNow(startedAt)} ms`
  );

  const resources = [...consolidatedDataResults, ...docRefResults];

  const hydrated = isReturnAllConsolidatedData
    ? resources
    : await hydrateResources({
        cxId: patient.cxId,
        patientId: patient.id,
        resources: resources,
      });

  const patientResource = patientToFhir(patient);
  const mutableResultingResources = hydrated.filter(r => r.resourceType !== "Patient");
  mutableResultingResources.push(patientResource);

  const entries = mutableResultingResources.map(buildBundleEntry);
  const resultBundle = buildSearchSetBundle(entries);

  log(
    `Done in ${elapsedTimeFromNow(startedAt)} ms, returning ${
      resultBundle.entry?.length
    } resources...`
  );

  return resultBundle;
}

async function hydrateResources({
  cxId,
  patientId,
  resources,
}: {
  cxId: string;
  patientId: string;
  resources: Resource[];
}): Promise<Resource[]> {
  const { log } = out(`hydrateResources - cx ${cxId}, pt ${patientId}`);

  log(`Hydrating ${resources.length} resources...`);
  const startHydrationAt = new Date();
  const hydrated = await hydrateMissingReferences({
    cxId,
    patientId,
    resources,
  });
  log(`Hydrated to ${hydrated.length} resources in ${elapsedTimeFromNow(startHydrationAt)} ms.`);

  // Reverse-hydration - resources that point to something we found and are needed to correctly
  // make use of the searched one (e.g., when we find a Medication, we need to load the MedicationRequests,
  // MedicationAdministrations, etc. that point to it)
  const isMedicationDictionary = groupBy(hydrated, isMedication);
  const medicationResources = isMedicationDictionary["true"] ?? [];
  const nonMedicationResources = isMedicationDictionary["false"] ?? [];

  const idsToReverseHydrate = medicationResources.flatMap(m => m.id ?? []);
  const idsToExclude = nonMedicationResources.flatMap(m => m.id ?? []);

  const startSearchByIdsAt = new Date();
  const reverseHydrated = await reverseHydrate({
    cxId,
    patientId,
    idsToInclude: idsToReverseHydrate,
    idsToExclude,
  });
  log(
    `Searched for reverse-references of ${
      idsToReverseHydrate.length
    } resources in ${elapsedTimeFromNow(startSearchByIdsAt)} ms.`
  );

  const result = [...hydrated, ...reverseHydrated];
  log(`Resources: ${resources.length}`);
  log(`Hydrated: ${hydrated.length}`);
  log(`Reverse Hydrated: ${reverseHydrated.length}`);
  log(`Result: ${result.length}`);
  return result;
}

/**
 * Hydrate resources that reference the ones on idsToInclude (parents, upstream).
 *
 * To be used exclusively in the case of querying OS as part of the hydration process.
 *
 * @param cxId - The customer ID.
 * @param patientId - The patient ID.
 * @param query - The query to search for.
 * @param idsToExclude - IMPORTANT: The IDs to exclude from the search, to avoid circular references.
 * @returns The search results.
 */
async function reverseHydrate({
  cxId,
  patientId,
  idsToInclude,
  idsToExclude,
}: {
  cxId: string;
  patientId: string;
  idsToInclude: string[];
  idsToExclude: string[];
}): Promise<Resource[]> {
  const { log } = out(`hydration.searchByIds - cx ${cxId}, pt ${patientId}`);

  if (idsToInclude.length < 1) return [];
  const uniqueIds = uniq(idsToInclude);
  const batches = chunk(uniqueIds, maxIdsPerQuery);
  const searchConsolidatedDataResult: FhirSearchResult[] = [];

  await executeAsynchronously(batches, async batch => {
    const query = `${simpleQueryStringPrefix} "${batch.join(`" "`)}"`;
    const batchResult = await timed(
      async () => {
        const { results } = await searchConsolidatedData({
          cxId,
          patientId,
          query,
        });
        return results;
      },
      "hydration.searchConsolidatedData",
      log
    );
    searchConsolidatedDataResult.push(...batchResult);
  });

  const resources = searchConsolidatedDataResult.flatMap(r => {
    const internalResource = fhirSearchResultToResource(r, log);
    if (!internalResource?.id || idsToExclude.includes(internalResource.id)) return [];
    return internalResource;
  });

  return resources;
}

/**
 * Hydrates the missing references in the resources.
 *
 * Doesn't hydrate the Patient resource in the resources array.
 *
 * @param cxId - The customer ID.
 * @param patientId - The patient ID.
 * @param resources - The resources to hydrate.
 * @param iteration - The iteration of the hydration.
 * @param hydratePatient - Whether to hydrate the Patient resource. Optional, defaults to false.
 * @returns The hydrated resources.
 */
export async function hydrateMissingReferences({
  cxId,
  patientId,
  resources,
  idsToExclude = [],
  iteration = 1,
}: {
  cxId: string;
  patientId: string;
  resources: Resource[];
  idsToExclude?: string[];
  iteration?: number;
}): Promise<Resource[]> {
  const { log } = out("OS.hydrateMissingReferences");

  if (iteration > maxHydrationAttempts) return resources;

  const resourcesToHydrate: ReferenceWithIdAndType<Resource>[] = [];

  const resourcesByType = groupBy(resources, "resourceType");
  Object.entries(resourcesByType).forEach(([currentResourceTypeParam, resourcesOfCurrentType]) => {
    const currentResourceType = currentResourceTypeParam as ResourceType;

    const { missingReferences } = getReferencesFromResources({
      resourcesToCheckRefs: resourcesOfCurrentType,
      sourceResources: resources,
    });

    if (missingReferences.length < 1) return;

    const missingRefsByType = groupBy(missingReferences, "type");

    const missingPractitioners = get(missingRefsByType, "Practitioner");
    if (missingPractitioners && missingPractitioners.length > 0) {
      resourcesToHydrate.push(...missingPractitioners);
    }

    const missingOrgs = get(missingRefsByType, "Organization");
    if (missingOrgs && missingOrgs.length > 0) {
      resourcesToHydrate.push(...missingOrgs);
    }

    if (currentResourceType === "DiagnosticReport") {
      const refResourcesToHydrate = ["Encounter", "Observation", "Location"] as ResourceType[];
      refResourcesToHydrate.forEach(refResourceType => {
        const missingRefResources = get(missingRefsByType, refResourceType);
        if (missingRefResources && missingRefResources.length > 0) {
          resourcesToHydrate.push(...missingRefResources);
        }
      });
    }

    if (currentResourceType === "Encounter") {
      const refResourcesToHydrate = ["Location"] as ResourceType[];
      refResourcesToHydrate.forEach(refResourceType => {
        const missingRefResources = get(missingRefsByType, refResourceType);
        if (missingRefResources && missingRefResources.length > 0) {
          resourcesToHydrate.push(...missingRefResources);
        }
      });
    }

    if (medRelatedResourceTypes.includes(currentResourceType as ResourceType)) {
      const missingMedRelatedResources = get(missingRefsByType, "Medication");
      if (missingMedRelatedResources && missingMedRelatedResources.length > 0) {
        resourcesToHydrate.push(...missingMedRelatedResources);
      }
    }
  });

  const missingRefIds = resourcesToHydrate.flatMap(r => {
    const referenceId = r.id;
    if (!referenceId || referenceId === patientId) return [];
    return getEntryId(cxId, patientId, referenceId);
  });
  if (missingRefIds.length < 1) return resources;

  const uniqueIds = uniq(missingRefIds);
  const filteredUniqueIds =
    idsToExclude.length > 0
      ? uniqueIds.filter(uniqueId => !idsToExclude.some(idToExclude => idToExclude === uniqueId))
      : uniqueIds;

  const searchService = new OpenSearchFhirSearcher(getConfigs());
  const openSearchResults = await searchService.getByIds({
    cxId,
    patientId,
    ids: filteredUniqueIds,
  });
  if (!openSearchResults || openSearchResults.length < 1) {
    log(`No results found for (count=${missingRefIds.length}) ${missingRefIds.join(", ")}`);
    return resources;
  }
  const resourcesToAdd = fhirSearchResultToResources(openSearchResults, log);

  const mergedResources = [...resources, ...resourcesToAdd];

  const hydratedResources = await hydrateMissingReferences({
    cxId,
    patientId,
    resources: mergedResources,
    idsToExclude,
    iteration: ++iteration,
  });

  return hydratedResources;
}

function get<K extends ResourceType, T extends ReferenceWithIdAndType<Resource>[]>(
  obj: Dictionary<T>,
  key: K
): T | undefined {
  return obj[key];
}

async function searchConsolidatedData({
  cxId,
  patientId,
  query,
}: {
  cxId: string;
  patientId: string;
  query: string | undefined;
}): Promise<{ isReturnAllResources: boolean; results: FhirSearchResult[] }> {
  const searchService = new OpenSearchFhirSearcher(getConfigs());
  return searchService.search({
    cxId,
    patientId,
    query,
  });
}

function fhirSearchResultToResources<T extends Resource>(
  fhirSearchResult: FhirSearchResult[],
  log: typeof console.log
): T[] {
  return fhirSearchResult.flatMap(r => fhirSearchResultToResource(r, log) ?? []) as T[];
}

function fhirSearchResultToResource<T extends Resource>(
  fhirSearchResult: FhirSearchResult,
  log: typeof console.log
): T | undefined {
  const resourceAsString = fhirSearchResult[rawContentFieldName];
  if (!resourceAsString) return undefined;
  try {
    return JSON.parse(resourceAsString) as T;
  } catch (error) {
    log(`Error parsing resource ${resourceAsString}: ${errorToString(error)}`);
    return undefined;
  }
}
