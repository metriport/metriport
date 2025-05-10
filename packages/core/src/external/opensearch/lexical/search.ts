import { SearchSetBundle } from "@metriport/shared/medical";
import { ConsolidatedSnapshotRequestSync } from "../../../command/consolidated/get-snapshot";
import { buildConsolidatedSnapshotConnector } from "../../../command/consolidated/get-snapshot-factory";
import { getConsolidatedSnapshotFromS3 } from "../../../command/consolidated/snapshot-on-s3";
import { Patient } from "../../../domain/patient";
import { out } from "../../../util";
import { Config } from "../../../util/config";
import { DocumentReferenceWithId } from "../../fhir/document/document-reference";
import { toFHIR as patientToFhir } from "../../fhir/patient/conversion";
import { buildBundleEntry } from "../../fhir/shared/bundle";
import { SearchResult } from "../index-based-on-resource";
import { searchDocuments } from "../search-documents";
import { OpenSearchLexicalSearcherDirect } from "./lexical-searcher-direct";
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
    getConsolidated({ patient }),
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

  log(`Done, returning ${sliced.length} filtered resources...`);

  return {
    resourceType: "Bundle",
    type: "searchset",
    total: sliced.length,
    entry: sliced,
  };
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
  const region = Config.getAWSRegion();
  const endpoint = Config.getSearchEndpoint();
  const indexName = Config.getSearchIndexName();
  const username = Config.getSearchUsername();
  const password = Config.getSearchPassword();

  // TODO eng-41 make this a factory so we can delegate the processing to a lambda
  const searchService = new OpenSearchLexicalSearcherDirect({
    region,
    endpoint,
    indexName,
    username,
    password,
  });
  return await searchService.search({
    query,
    cxId,
    patientId,
    maxNumberOfResults,
  });
}

async function getConsolidated({ patient }: { patient: Patient }): Promise<SearchSetBundle> {
  const payload: ConsolidatedSnapshotRequestSync = {
    patient,
    isAsync: false,
  };
  const connector = buildConsolidatedSnapshotConnector();
  const { bundleLocation, bundleFilename } = await connector.execute(payload);
  const bundle = await getConsolidatedSnapshotFromS3({ bundleLocation, bundleFilename });
  return bundle;
}
