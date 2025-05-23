import { Patient } from "../../../../domain/patient";
import { OnBulkItemError } from "../../../../external/opensearch/shared/bulk";
import { OpenSearchTextIngestor } from "../../../../external/opensearch/text-ingestor";
import { out } from "../../../../util";
import { Config } from "../../../../util/config";
import { getConsolidatedAsText } from "../../consolidated-get";
import { convertFhirResourceToTextToIngestRequestResource } from "../../../../external/opensearch/text-ingestor";

/**
 * Ingest a patient's consolidated resources into OpenSearch for semantic search.
 *
 * @param patient The patient to ingest.
 * @param onItemError A callback to handle errors when ingesting a resource.
 */
export async function ingestSemantic({
  patient,
  onItemError,
}: {
  patient: Patient;
  onItemError?: OnBulkItemError;
}) {
  const { log } = out(`ingestSemantic - cx ${patient.cxId}, pt ${patient.id}`);

  const convertedResources = await getConsolidatedAsText({ patient });

  const ingestor = new OpenSearchTextIngestor({
    region: Config.getAWSRegion(),
    endpoint: Config.getSemanticSearchEndpoint(),
    indexName: Config.getSemanticSearchIndexName(),
    username: Config.getSemanticSearchUsername(),
    password: Config.getSemanticSearchPassword(),
    settings: { logLevel: "info" },
  });

  const startedAt = Date.now();
  const resources = convertedResources.map(convertFhirResourceToTextToIngestRequestResource);
  await ingestor.ingestBulk({
    cxId: patient.cxId,
    patientId: patient.id,
    resources,
    onItemError,
  });
  const elapsedTime = Date.now() - startedAt;

  log(`Ingested ${convertedResources.length} resources in ${elapsedTime} ms`);
}
