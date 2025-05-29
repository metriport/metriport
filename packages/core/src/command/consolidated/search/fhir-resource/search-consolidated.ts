import { Resource } from "@medplum/fhirtypes";
import { errorToString } from "@metriport/shared";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { SearchSetBundle } from "@metriport/shared/medical";
import { uniq } from "lodash";
import { Features } from "../../../../domain/features";
import { Patient } from "../../../../domain/patient";
import { CloudWatchUtils, Metrics, withMetrics } from "../../../../external/aws/cloudwatch";
import { toFHIR as patientToFhir } from "../../../../external/fhir/patient/conversion";
import {
  buildBundleEntry,
  buildSearchSetBundle,
  getReferencesFromResources,
} from "../../../../external/fhir/shared/bundle";
import {
  FhirSearchResult,
  rawContentFieldName,
} from "../../../../external/opensearch/index-based-on-fhir";
import { OpenSearchConsolidatedSearcher } from "../../../../external/opensearch/lexical/fhir-searcher";
import { getEntryId } from "../../../../external/opensearch/shared/id";
import { out } from "../../../../util";
import { Config } from "../../../../util/config";
import { searchDocuments } from "../document-reference/search";
import { getConfigs } from "./fhir-config";

const maxHydrationAttempts = 5;

const cloudWatchUtils = new CloudWatchUtils(Config.getAWSRegion(), Features.ConsolidatedSearch);

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
 * @param query The query to search for.
 * @returns The search results.
 */
export async function searchPatientConsolidated({
  patient,
  query,
}: {
  patient: Patient;
  query: string;
}): Promise<SearchSetBundle> {
  const { log } = out(`searchPatientConsolidated - cx ${patient.cxId}, pt ${patient.id}`);

  log(`Getting consolidated and searching OS...`);
  const metrics: Metrics = {};
  const startedAt = Date.now();

  const searchConsolidatedPromise = () =>
    searchConsolidated({
      cxId: patient.cxId,
      patientId: patient.id,
      query,
    });

  const searchDocumentsPromise = () =>
    searchDocuments({ cxId: patient.cxId, patientId: patient.id, contentFilter: query });

  let localStartedAt = Date.now();
  const [fhirResourcesResults, docRefResults] = await Promise.all([
    withMetrics(searchConsolidatedPromise, "search_consolidated", metrics, log),
    withMetrics(searchDocumentsPromise, "search_documents", metrics, log),
  ]);
  let elapsedTime = Date.now() - localStartedAt;
  metrics.search_subTotal = { duration: elapsedTime, timestamp: new Date() };
  log(
    `Got ${fhirResourcesResults.length} resources and ${docRefResults.length} DocRefs in ${elapsedTime} ms, hydrating search results...`
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

  localStartedAt = Date.now();
  const hydratedMutable = await hydrateMissingReferences({
    cxId: patient.cxId,
    patientId: patient.id,
    resources: resourcesMutable,
  });
  elapsedTime = Date.now() - localStartedAt;
  metrics.search_hydrate = { duration: elapsedTime, timestamp: new Date() };
  log(`Hydrated to ${hydratedMutable.length} resources in ${elapsedTime} ms.`);

  const patientResource = patientToFhir(patient);
  hydratedMutable.push(patientResource);

  const entries = hydratedMutable.map(buildBundleEntry);
  const resultBundle = buildSearchSetBundle(entries);

  elapsedTime = Date.now() - startedAt;
  metrics.search_total = { duration: elapsedTime, timestamp: new Date() };
  await cloudWatchUtils.reportMetrics(metrics);
  log(`Done in ${elapsedTime} ms, returning ${resultBundle.entry?.length} resources...`);

  return resultBundle;
}

async function searchConsolidated({
  cxId,
  patientId,
  query,
}: {
  cxId: string;
  patientId: string;
  query: string;
}): Promise<FhirSearchResult[]> {
  const searchService = new OpenSearchConsolidatedSearcher(getConfigs());
  return await searchService.search({
    cxId,
    patientId,
    query,
  });
}

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

  const { missingReferences } = getReferencesFromResources({ resources });
  const missingRefIds = missingReferences.flatMap(r => {
    const referenceId = r.id;
    if (!referenceId || referenceId === patientId) return [];
    return getEntryId(cxId, patientId, referenceId);
  });
  if (missingRefIds.length < 1 || iteration >= maxHydrationAttempts) return resources;

  const uniqueIds = uniq(missingRefIds);

  const searchService = new OpenSearchConsolidatedSearcher(getConfigs());
  const openSearchResults = await searchService.getByIds({
    cxId,
    patientId,
    ids: uniqueIds,
  });
  if (!openSearchResults || openSearchResults.length < 1) {
    log(`No results found for ${missingRefIds.join(", ")}`);
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
