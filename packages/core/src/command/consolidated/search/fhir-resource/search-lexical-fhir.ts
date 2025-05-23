import { Resource } from "@medplum/fhirtypes";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { SearchSetBundle } from "@metriport/shared/medical";
import { timed } from "@metriport/shared/util/duration";
import { Patient } from "../../../../domain/patient";
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
import { OpenSearchFhirSearcher } from "../../../../external/opensearch/lexical/fhir-searcher";
import { getEntryId } from "../../../../external/opensearch/shared/id";
import { executeAsynchronously, out } from "../../../../util";
import { searchDocuments } from "../document-reference/search";
import { getConfigs } from "./fhir-config";

const numberOfParallelHydrationQueries = 10;
const maxHydrationAttempts = 5;

/**
 * Performs a lexical search on a patient's consolidated resources in OpenSearch
 * and returns the resources from consolidated that match the search results.
 */
export async function searchLexicalFhir({
  patient,
  query,
}: {
  patient: Patient;
  query: string;
}): Promise<SearchSetBundle> {
  const { log } = out(`searchLexicalFhir - cx ${patient.cxId}, pt ${patient.id}`);

  log(`Getting consolidated and searching OS...`);
  const startedAt = new Date();

  const [fhirResourcesResults, docRefResults] = await Promise.all([
    timed(
      () =>
        searchFhirResources({
          cxId: patient.cxId,
          patientId: patient.id,
          query,
        }),
      "searchFhirResources",
      log
    ),
    timed(
      () =>
        searchDocuments({
          cxId: patient.cxId,
          patientId: patient.id,
          contentFilter: query,
        }),
      "searchDocuments",
      log
    ),
  ]);
  log(
    `Got ${fhirResourcesResults.length} Resources and ${
      docRefResults.length
    } DocRefs in ${elapsedTimeFromNow(startedAt)} ms, hydrating search results...`
  );

  let subStartedAt = new Date();
  const resourcesMutable = fhirResourcesResults.flatMap(r => {
    const resourceAsString = r[rawContentFieldName];
    if (!resourceAsString) return [];
    return JSON.parse(resourceAsString) as Resource;
  });
  resourcesMutable.push(...docRefResults);
  log(
    `Loaded/converted ${resourcesMutable.length} resources in ${elapsedTimeFromNow(
      subStartedAt
    )} ms.`
  );

  subStartedAt = new Date();
  const hydratedMutable = await hydrateMissingReferences({
    cxId: patient.cxId,
    patientId: patient.id,
    resources: resourcesMutable,
  });
  log(
    `Hydrated to ${hydratedMutable.length} resources in ${elapsedTimeFromNow(subStartedAt)}} ms.`
  );

  const patientResource = patientToFhir(patient);
  hydratedMutable.push(patientResource);

  const entries = hydratedMutable.map(buildBundleEntry);
  const resultBundle = buildSearchSetBundle({ entries });

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
  query: string;
}): Promise<FhirSearchResult[]> {
  const searchService = new OpenSearchFhirSearcher(getConfigs());
  return await searchService.search({
    cxId,
    patientId,
    query,
  });
}

async function hydrateMissingReferences({
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
  const { missingReferences } = getReferencesFromResources({ resources });
  if (missingReferences.length < 1 || iteration >= maxHydrationAttempts) return resources;

  const resourcesToAdd: Resource[] = [];
  await executeAsynchronously(
    missingReferences,
    async reference => {
      const referenceId = reference.id;
      if (referenceId === patientId) return;
      const hydratedResource = await getResource(cxId, patientId, referenceId);
      if (hydratedResource) resourcesToAdd.push(hydratedResource);
    },
    { numberOfParallelExecutions: numberOfParallelHydrationQueries }
  );

  const hydratedResourcesToAdd = await hydrateMissingReferences({
    cxId,
    patientId,
    resources: resourcesToAdd,
    iteration: ++iteration,
  });

  const result = [...resources, ...hydratedResourcesToAdd];
  return result;
}

async function getResource(
  cxId: string,
  patientId: string,
  referenceId: string
): Promise<Resource | undefined> {
  const entryId = getEntryId(cxId, patientId, referenceId);
  const searchService = new OpenSearchFhirSearcher(getConfigs());
  const hydratedResource = await searchService.getById(entryId);
  if (!hydratedResource) return undefined;
  const resource = JSON.parse(hydratedResource[rawContentFieldName]) as Resource;
  return resource;
}
