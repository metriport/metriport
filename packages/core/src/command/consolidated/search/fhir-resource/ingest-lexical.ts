import { Patient } from "../../../../domain/patient";
import {
  OpenSearchLexicalSearcher,
  OpenSearchLexicalSearcherConfig,
} from "../../../../external/opensearch/lexical/lexical-searcher";
import { OnBulkItemError } from "../../../../external/opensearch/shared/bulk";
import { OpenSearchTextIngestor } from "../../../../external/opensearch/text-ingestor";
import { capture, out } from "../../../../util";
import { Config } from "../../../../util/config";
import { getConsolidatedAsText } from "../../consolidated-get";

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

  const ingestor = new OpenSearchTextIngestor({
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
  const errors = await ingestor.ingestBulk({
    cxId: patient.cxId,
    patientId: patient.id,
    resources,
    onItemError,
  });
  const elapsedTime = Date.now() - startedAt;

  if (errors.size > 0) captureErrors({ cxId: patient.cxId, patientId: patient.id, errors, log });

  log(`Ingested ${convertedResources.length} resources in ${elapsedTime} ms`);
}

/**
 * Initialize the lexical index in OpenSearch.
 */
export async function initializeLexicalIndex() {
  const searchService = new OpenSearchLexicalSearcher(getConfigs());
  await searchService.createIndexIfNotExists();
}

function getConfigs(): OpenSearchLexicalSearcherConfig {
  return {
    region: Config.getAWSRegion(),
    endpoint: Config.getSearchEndpoint(),
    indexName: Config.getConsolidatedSearchIndexName(),
    username: Config.getSearchUsername(),
    password: Config.getSearchPassword(),
  };
}

function captureErrors({
  cxId,
  patientId,
  errors,
  log,
}: {
  cxId: string;
  patientId: string;
  errors: Map<string, number>;
  log: typeof console.log;
}) {
  const errorMapToObj = Object.fromEntries(errors.entries());
  log(`Errors: `, () => JSON.stringify(errorMapToObj));
  capture.error("Errors ingesting resources into OpenSearch", {
    extra: { cxId, patientId, countPerErrorType: JSON.stringify(errorMapToObj, null, 2) },
  });
}
