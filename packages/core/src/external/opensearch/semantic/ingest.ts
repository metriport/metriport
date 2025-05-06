import { Patient } from "../../../domain/patient";
import { out } from "../../../util";
import { Config } from "../../../util/config";
import { bundleToString } from "../../fhir/export/string/bundle-to-string";
import { OpenSearchTextIngestorDirect } from "../text-ingestor-direct";
import { getConsolidated } from "./shared";

/**
 * Ingest a patient's consolidated resources into OpenSearch for semantic search.
 *
 * @param patient The patient to ingest.
 */
export async function ingestSemantic({ patient }: { patient: Patient }) {
  const { log } = out(`ingestSemantic - cx ${patient.cxId}, pt ${patient.id}`);

  const consolidated = await getConsolidated({ patient });

  const convertedResources = bundleToString(consolidated);

  const ingestor = new OpenSearchTextIngestorDirect({
    region: Config.getAWSRegion(),
    endpoint: Config.getSemanticSearchEndpoint(),
    indexName: Config.getSemanticSearchIndexName(),
    username: Config.getSemanticSearchUsername(),
    password: Config.getSemanticSearchPassword(),
    settings: { logLevel: "info" },
  });

  // TODO eng-41 Figure out how to do this in bulk, chunking to the limit of items per bulk
  const startedAt = Date.now();
  for (const resource of convertedResources) {
    await ingestor.ingest({
      cxId: patient.cxId,
      patientId: patient.id,
      resourceType: resource.resourceType,
      resourceId: resource.id,
      content: resource.text,
    });
  }
  const elapsedTime = Date.now() - startedAt;

  log(`Ingested ${convertedResources.length} resources in ${elapsedTime} ms`);
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
