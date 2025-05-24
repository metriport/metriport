import { OpenSearchLexicalSearcherConfig } from "../../../../external/opensearch/lexical/lexical-searcher";
import { Config } from "../../../../util/config";

export function getConfigs(): OpenSearchLexicalSearcherConfig {
  return {
    region: Config.getAWSRegion(),
    endpoint: Config.getSearchEndpoint(),
    indexName: getFhirIndexName(Config.getConsolidatedSearchIndexName()),
    username: Config.getSearchUsername(),
    password: Config.getSearchPassword(),
  };
}

function getFhirIndexName(indexName: string) {
  return indexName + "-fhir";
}
