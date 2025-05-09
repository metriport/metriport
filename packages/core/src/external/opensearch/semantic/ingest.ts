import { Patient } from "../../../domain/patient";
import { out } from "../../../util";
import { Config } from "../../../util/config";
import { bundleToString, FhirResourceToText } from "../../fhir/export/string/bundle-to-string";
import { OnBulkItemError } from "../bulk";
import { OpenSearchTextIngestorDirect } from "../text-ingestor-direct";
import { getConsolidated } from "./shared";

/**
 * Ingest a patient's consolidated resources into OpenSearch for semantic search.
 *
 * @param patient The patient to ingest.
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

  const ingestor = new OpenSearchTextIngestorDirect({
    region: Config.getAWSRegion(),
    endpoint: Config.getSemanticSearchEndpoint(),
    indexName: Config.getSemanticSearchIndexName(),
    username: Config.getSemanticSearchUsername(),
    password: Config.getSemanticSearchPassword(),
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

export async function getConsolidatedAsText({
  patient,
}: {
  patient: Patient;
}): Promise<FhirResourceToText[]> {
  const consolidated = await getConsolidated({ patient });
  return bundleToString(consolidated);
}

// TODO eng-41 Convert this to actual code to create the index if not exists and decide where to call it from

/*
PUT /medical-resources
{
    "settings": {
        "index.knn": true,
        "default_pipeline": "embedding-ingest-pipeline",
        "index.search.default_pipeline": "hybrid-search-pipeline"
    },
    "mappings": {
        "properties": {
            "content_embedding": {
                "type": "knn_vector",
                "dimension": 768,
                "method": {
                    "name": "hnsw",
                    "space_type": "innerproduct",
                    "engine": "nmslib"
                }
            },
            "cxId": { "type": "keyword" },
            "patientId": { "type": "keyword" },
            "resourceType": { "type": "keyword" },
            "resourceId": { "type": "keyword" },
            "content": { "type": "text" }
        }
    }
}
*/
