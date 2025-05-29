import { OpenSearchConsolidatedSearcherConfig } from "../../../../external/opensearch/lexical/fhir-searcher";
import { Config } from "../../../../util/config";

export function getConfigs(): OpenSearchConsolidatedSearcherConfig {
  return {
    region: Config.getAWSRegion(),
    endpoint: Config.getSearchEndpoint(),
    indexName: Config.getConsolidatedSearchIndexName(),
    username: Config.getSearchUsername(),
    password: Config.getSearchPassword(),
  };
}
