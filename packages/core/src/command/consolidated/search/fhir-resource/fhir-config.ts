import { OpenSearchFhirSearcherConfig } from "../../../../external/opensearch/lexical/fhir-searcher";
import { Config } from "../../../../util/config";

export function getConfigs(): OpenSearchFhirSearcherConfig {
  return {
    region: Config.getAWSRegion(),
    endpoint: Config.getSearchEndpoint(),
    indexName: Config.getConsolidatedSearchIndexName(),
    username: Config.getSearchUsername(),
    password: Config.getSearchPassword(),
  };
}
