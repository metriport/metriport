import { Patient } from "@metriport/core/src/domain/patient";
import { Config } from "@metriport/core/src/util/config";
import { OnBulkItemError } from "../../../external/opensearch/bulk";
import { OpenSearchTextIngestorDirect } from "../../../external/opensearch/text-ingestor-direct";
import { out } from "../../../util";
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

  const convertedResources = await getConsolidatedAsText({ patient });

  const ingestor = new OpenSearchTextIngestorDirect({
    region: Config.getAWSRegion(),
    endpoint: Config.getSearchEndpoint(),
    indexName: Config.getSearchIndexName(),
    username: Config.getSearchUsername(),
    password: Config.getSearchPassword(),
    settings: { logLevel: "info" },
  });

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
