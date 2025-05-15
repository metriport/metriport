import { SearchSetBundle } from "@metriport/shared/medical";
import { Patient } from "../../../../domain/patient";
import { DocumentReferenceWithId } from "../../../../external/fhir/document/document-reference";
import { toFHIR as patientToFhir } from "../../../../external/fhir/patient/conversion";
import { buildBundleEntry, buildSearchSetBundle } from "../../../../external/fhir/shared/bundle";
import { SearchResult } from "../../../../external/opensearch/index-based-on-resource";
import { OpenSearchLexicalSearcher } from "../../../../external/opensearch/lexical/lexical-searcher";
import { out } from "../../../../util";
import { Config } from "../../../../util/config";
import { addMissingReferences } from "../../consolidated-filter";
import { getConsolidatedPatientData } from "../../consolidated-get";
import { searchDocuments } from "../document-reference/search";

/**
 * Performs a lexical search on a patient's consolidated resources in OpenSearch
 * and returns the resources from consolidated that match the search results.
 */
export async function searchLexical({
  patient,
  query,
  maxNumberOfResults = 10_000,
}: {
  patient: Patient;
  query: string;
  /** From 0 to 10_000, optional, defaults to 10_000 */
  maxNumberOfResults?: number | undefined;
}): Promise<SearchSetBundle> {
  const { log } = out(`searchLexical - cx ${patient.cxId}, pt ${patient.id}`);

  log(`Getting consolidated and searching OS...`);
  const startedAt = Date.now();

  const [consolidated, searchResults, docRefResults] = await Promise.all([
    getConsolidatedPatientData({ patient }),
    searchOpenSearch({
      cxId: patient.cxId,
      patientId: patient.id,
      query,
      maxNumberOfResults,
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
        (isInLexicalResults(searchResults, resourceId, resourceType) ||
          isInDocRefResults(docRefResults, resourceId, resourceType))
      );
    }) ?? [];

  const sliced = filteredResources.slice(0, maxNumberOfResults - 1);
  const patientEntry = buildBundleEntry(patientToFhir(patient));
  sliced.push(patientEntry);

  const filteredBundle = buildSearchSetBundle({ entries: sliced });
  const hydrated = addMissingReferences(filteredBundle, consolidated);

  log(`Done, returning ${hydrated.entry?.length} filtered resources...`);

  return hydrated as SearchSetBundle;
}

function isInLexicalResults(
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
}: {
  query: string;
  cxId: string;
  patientId: string;
  maxNumberOfResults?: number | undefined;
}) {
  // TODO eng-41 make this a factory so we can delegate the processing to a lambda
  const searchService = new OpenSearchLexicalSearcher({
    region: Config.getAWSRegion(),
    endpoint: Config.getSearchEndpoint(),
    indexName: Config.getLexicalSearchIndexName(),
    username: Config.getSearchUsername(),
    password: Config.getSearchPassword(),
  });
  return await searchService.search({
    query,
    cxId,
    patientId,
    maxNumberOfResults,
  });
}
