import { SearchSetBundle } from "@metriport/shared/medical";
import { Patient } from "../../../domain/patient";
import { out } from "../../../util";
import { Config } from "../../../util/config";
import { DocumentReferenceWithId } from "../../fhir/document/document-reference";
import { toFHIR as patientToFhir } from "../../fhir/patient/conversion";
import { buildBundleEntry } from "../../fhir/shared/bundle";
import { searchDocuments } from "../search-documents";
import { OpenSearchSemanticSearcherDirect, SearchResult } from "./semantic-searcher-direct";
import { getConsolidated } from "./shared";

/**
 * Performs a semantic search on a patient's consolidated resources in OpenSearch
 * and returns the resources from consolidated that match the search results.
 */
export async function searchSemantic({
  patient,
  query,
  maxNumberOfResults = 10_000,
  similarityThreshold,
}: {
  patient: Patient;
  query: string;
  /** From 0 to 10_000, optional, defaults to 10_000 */
  maxNumberOfResults?: number | undefined;
  /** From 0 to 1, optional. See OpenSearchSemanticSearcherDirect for defaults. */
  similarityThreshold?: number | undefined;
}): Promise<SearchSetBundle> {
  const { log } = out(`searchSemantic - cx ${patient.cxId}, pt ${patient.id}`);

  log(`Getting consolidated and searching OS...`);
  const startedAt = Date.now();

  const [consolidated, searchResults, docRefResults] = await Promise.all([
    getConsolidated({ patient }),
    searchOpenSearch({
      cxId: patient.cxId,
      patientId: patient.id,
      query,
      maxNumberOfResults,
      similarityThreshold,
    }),
    searchDocuments({ cxId: patient.cxId, patientId: patient.id, contentFilter: query }),
  ]);
  const elapsedTime = Date.now() - startedAt;
  log(
    `Done, got ${searchResults.length} search results and ${consolidated.entry?.length} consolidated ` +
      `resources in ${elapsedTime} ms, filtering consolidated based on search results...`
  );

  const filteredResources =
    consolidated.entry?.filter(entry => {
      const resourceId = entry.resource?.id;
      const resourceType = entry.resource?.resourceType;
      if (!resourceId || !resourceType) return false;
      return (
        resourceType !== "Patient" &&
        (isInSemanticResults(searchResults, resourceId, resourceType) ||
          isInDocRefResults(docRefResults, resourceId, resourceType))
      );
    }) ?? [];

  const sliced = filteredResources.slice(0, maxNumberOfResults - 1);
  const patientEntry = buildBundleEntry(patientToFhir(patient));
  sliced.push(patientEntry);

  log(`Done, returning ${sliced.length} filtered resources...`);

  return {
    resourceType: "Bundle",
    type: "searchset",
    total: sliced.length,
    entry: sliced,
  };
}

function isInSemanticResults(
  searchResults: SearchResult[],
  resourceId: string,
  resourceType: string
) {
  return searchResults.some(r => r.resourceId === resourceId && r.resourceType === resourceType);
}

function isInDocRefResults(
  docRefResults: DocumentReferenceWithId[],
  resourceId: string,
  resourceType: string
) {
  if (resourceType !== "DocumentReference") return false;
  return docRefResults.some(r => r.id === resourceId);
}

async function searchOpenSearch({
  query,
  cxId,
  patientId,
  maxNumberOfResults,
  similarityThreshold,
}: {
  query: string;
  cxId: string;
  patientId: string;
  maxNumberOfResults?: number | undefined;
  similarityThreshold?: number | undefined;
}) {
  const region = Config.getAWSRegion();
  const endpoint = Config.getSemanticSearchEndpoint();
  const indexName = Config.getSemanticSearchIndexName();
  const username = Config.getSemanticSearchUsername();
  const password = Config.getSemanticSearchPassword();
  const modelId = Config.getSemanticSearchModelId();

  // TODO eng-41 make this a factory so we can delegate the processing to a lambda
  const searchService = new OpenSearchSemanticSearcherDirect({
    region,
    endpoint,
    indexName,
    username,
    password,
    modelId,
  });
  return await searchService.search({
    query,
    cxId,
    patientId,
    maxNumberOfResults,
    similarityThreshold,
  });
}
