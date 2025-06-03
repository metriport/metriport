import { Resource, ResourceType } from "@medplum/fhirtypes";
import { errorToString } from "@metriport/shared";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { SearchSetBundle } from "@metriport/shared/medical";
import { timed } from "@metriport/shared/util/duration";
import { Dictionary, groupBy, uniq } from "lodash";
import { Patient } from "../../../../domain/patient";
import { toFHIR as patientToFhir } from "../../../../external/fhir/patient/conversion";
import {
  buildBundleEntry,
  buildSearchSetBundle,
  getReferencesFromResources,
  ReferenceWithIdAndType,
} from "../../../../external/fhir/shared/bundle";
import {
  FhirSearchResult,
  rawContentFieldName,
} from "../../../../external/opensearch/index-based-on-fhir";
import { OpenSearchFhirSearcher } from "../../../../external/opensearch/lexical/fhir-searcher";
import { getEntryId } from "../../../../external/opensearch/shared/id";
import { out } from "../../../../util";
import { searchDocuments } from "../document-reference/search";
import { getConfigs } from "./fhir-config";

const maxHydrationAttempts = 5;

const medRelatedResourceTypes: ResourceType[] = [
  "Medication",
  "MedicationRequest",
  "MedicationDispense",
  "MedicationAdministration",
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

  log(`Getting consolidated and searching OS...`);
  const startedAt = new Date();

  const searchFhirResourcesPromise = () =>
    searchFhirResources({
      cxId: patient.cxId,
      patientId: patient.id,
      query,
    });

  const searchDocumentsPromise = () =>
    searchDocuments({ cxId: patient.cxId, patientId: patient.id, contentFilter: query });

  const [fhirResourcesResults, docRefResults] = await Promise.all([
    timed(searchFhirResourcesPromise, "searchFhirResources", log),
    timed(searchDocumentsPromise, "searchDocuments", log),
  ]);

  log(
    `Got ${fhirResourcesResults.length} resources and ${
      docRefResults.length
    } DocRefs in ${elapsedTimeFromNow(startedAt)} ms`
  );

  let subStartedAt = new Date();
  const resourcesMutable = fhirResourcesResults.flatMap(
    r => fhirSearchResultToResource(r, log) ?? []
  );
  resourcesMutable.push(...docRefResults);
  log(
    `Loaded/converted ${resourcesMutable.length} resources in ${elapsedTimeFromNow(
      subStartedAt
    )} ms, hydrating search results...`
  );

  subStartedAt = new Date();
  const hydrated = await hydrateMissingReferences({
    cxId: patient.cxId,
    patientId: patient.id,
    resources: resourcesMutable,
  });
  log(`Hydrated to ${hydrated.length} resources in ${elapsedTimeFromNow(subStartedAt)} ms.`);

  const withoutPatient = hydrated.filter(r => r.resourceType !== "Patient");

  const patientResource = patientToFhir(patient);
  const withPatient = [...withoutPatient, patientResource];

  const entries = withPatient.map(buildBundleEntry);
  const resultBundle = buildSearchSetBundle(entries);

  log(
    `Done in ${elapsedTimeFromNow(startedAt)} ms, returning ${
      resultBundle.entry?.length
    } resources...`
  );

  return resultBundle;
}

async function searchFhirResources({
  cxId,
  patientId,
  query,
}: {
  cxId: string;
  patientId: string;
  query: string | undefined;
}): Promise<FhirSearchResult[]> {
  const searchService = new OpenSearchFhirSearcher(getConfigs());
  return await searchService.search({
    cxId,
    patientId,
    query,
  });
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
  iteration = 1,
}: {
  cxId: string;
  patientId: string;
  resources: Resource[];
  iteration?: number;
}): Promise<Resource[]> {
  const { log } = out("OS.hydrateMissingReferences");

  if (iteration > maxHydrationAttempts) return resources;

  const resourcesToHydrate: ReferenceWithIdAndType<Resource>[] = [];

  const resourcesByType = groupBy(resources, "resourceType");
  Object.entries(resourcesByType).forEach(([currentResourceType, resourcesOfCurrentType]) => {
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
      const missingEncounters = get(missingRefsByType, "Encounter");
      if (missingEncounters && missingEncounters.length > 0) {
        resourcesToHydrate.push(...missingEncounters);
      }
      const missingObservations = get(missingRefsByType, "Observation");
      if (missingObservations && missingObservations.length > 0) {
        resourcesToHydrate.push(...missingObservations);
      }
    }

    if (medRelatedResourceTypes.includes(currentResourceType as ResourceType)) {
      medRelatedResourceTypes.forEach(medRelatedResourceType => {
        const missingMedRelatedResources = get(missingRefsByType, medRelatedResourceType);
        if (missingMedRelatedResources && missingMedRelatedResources.length > 0) {
          resourcesToHydrate.push(...missingMedRelatedResources);
        }
      });
    }
  });

  const missingRefIds = resourcesToHydrate.flatMap(r => {
    const referenceId = r.id;
    if (!referenceId || referenceId === patientId) return [];
    return getEntryId(cxId, patientId, referenceId);
  });
  if (missingRefIds.length < 1) return resources;

  const uniqueIds = uniq(missingRefIds);

  const searchService = new OpenSearchFhirSearcher(getConfigs());
  const openSearchResults = await searchService.getByIds({
    cxId,
    patientId,
    ids: uniqueIds,
  });
  if (!openSearchResults || openSearchResults.length < 1) {
    log(`No results found for (count=${missingRefIds.length}) ${missingRefIds.join(", ")}`);
    return resources;
  }
  const resourcesToAdd = openSearchResults.flatMap(r => fhirSearchResultToResource(r, log) ?? []);

  const mergedResources = [...resources, ...resourcesToAdd];

  const hydratedResources = await hydrateMissingReferences({
    cxId,
    patientId,
    resources: mergedResources,
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
