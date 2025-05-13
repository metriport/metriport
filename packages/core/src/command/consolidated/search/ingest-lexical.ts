import { Patient } from "../../../domain/patient";
import { OnBulkItemError } from "../../../external/opensearch/bulk";
import {
  OpenSearchLexicalSearcherDirect,
  OpenSearchLexicalSearcherDirectConfig,
} from "../../../external/opensearch/lexical/lexical-searcher-direct";
import { OpenSearchTextIngestorDirect } from "../../../external/opensearch/text-ingestor-direct";
import { out } from "../../../util";
import { Config } from "../../../util/config";
import { getConsolidatedAsText } from "../consolidated-get";

/**
 * Ingest a patient's consolidated resources into OpenSearch for lexical search.
 *
 * @param patient The patient to ingest.
 */
export async function ingestLexical({
  patient,
  onItemError,
}: {
  patient: Patient;
  onItemError?: OnBulkItemError;
}) {
  const { log } = out(`ingestLexical - cx ${patient.cxId}, pt ${patient.id}`);

  const ingestor = new OpenSearchTextIngestorDirect({
    ...getConfigs(),
    settings: { logLevel: "info" },
  });

  const [convertedResources] = await Promise.all([
    getConsolidatedAsText({ patient }),
    ingestor.delete({ cxId: patient.cxId, patientId: patient.id }),
  ]);

  const startedAt = Date.now();
  const resources = convertedResources.map(resource => ({
    resourceType: resource.type,
    resourceId: resource.id,
    content: resource.text,
  }));
  await ingestor.ingestBulk({
    cxId: patient.cxId,
    patientId: patient.id,
    resources,
    onItemError,
  });
  const elapsedTime = Date.now() - startedAt;

  log(`Ingested ${convertedResources.length} resources in ${elapsedTime} ms`);
}

/**
 * Initialize the lexical index in OpenSearch.
 */
export async function initializeLexicalIndex() {
  const searchService = new OpenSearchLexicalSearcherDirect(getConfigs());
  await searchService.createIndexIfNotExists();
}

function getConfigs(): OpenSearchLexicalSearcherDirectConfig {
  return {
    region: Config.getAWSRegion(),
    endpoint: Config.getSearchEndpoint(),
    indexName: Config.getLexicalSearchIndexName(),
    username: Config.getSearchUsername(),
    password: Config.getSearchPassword(),
  };
}
