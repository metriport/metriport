import { SearchSetBundle } from "@metriport/shared/medical";
import { Patient } from "../../../domain/patient";
import { out } from "../../../util";
import { Config } from "../../../util/config";
import { OpenSearchSemanticSearcherDirect } from "./semantic-searcher-direct";
import { getConsolidated } from "./shared";

/**
 * Performs a semantic search on a patient's consolidated resources in OpenSearch
 * and returns the resources from consolidated that match the search results.
 */
export async function searchSemantic({
  patient,
  query,
}: {
  patient: Patient;
  query: string;
}): Promise<SearchSetBundle> {
  const { log } = out(`searchSemantic - cx ${patient.cxId}, pt ${patient.id}`);
  log(`Getting consolidated and searching OS...`);
  const startedAt = Date.now();

  const [consolidated, searchResults] = await Promise.all([
    getConsolidated({ patient }),
    searchOpenSearch({ query, cxId: patient.cxId, patientId: patient.id }),
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
      return searchResults.some(
        r => r.resourceId === resourceId && r.resourceType === resourceType
      );
    }) ?? [];

  log(`Done, returning ${filteredResources.length} filtered resources...`);

  return {
    resourceType: "Bundle",
    type: "searchset",
    entry: filteredResources,
    total: filteredResources.length,
  };
}

async function searchOpenSearch({
  query,
  cxId,
  patientId,
}: {
  query: string;
  cxId: string;
  patientId: string;
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
  return await searchService.search({ query, cxId, patientId });
}
