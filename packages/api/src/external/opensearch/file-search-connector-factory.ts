import {
  OpenSearchFileIngestor,
  OpenSearchFileIngestorDirect,
  OpenSearchFileIngestorSQS,
  OpenSearchFileSearcher,
  OpenSearchFileSearcherDirect,
} from "@metriport/core/opensearch";
import { Config } from "../../shared/config";

export function makeSearchServiceIngest(): OpenSearchFileIngestor {
  const region = Config.getAWSRegion();
  if (!region) throw new Error(`AWS region is required`);
  const endpoint = Config.getSearchEndpoint();
  const indexName = Config.getSearchIndexName();
  const username = Config.getSearchUsername();
  const password = Config.getSearchPassword();
  if (Config.isDev()) {
    return new OpenSearchFileIngestorDirect({
      region,
      endpoint,
      indexName,
      username,
      password,
    });
  }
  return new OpenSearchFileIngestorSQS({
    region,
    indexName,
    queueUrl: Config.getSearchIngestionQueueUrl(),
  });
}

export function makeSearchServiceQuery(): OpenSearchFileSearcher {
  const region = Config.getAWSRegion();
  if (!region) throw new Error(`AWS region is required`);
  const endpoint = Config.getSearchEndpoint();
  const indexName = Config.getSearchIndexName();
  const username = Config.getSearchUsername();
  const password = Config.getSearchPassword();
  return new OpenSearchFileSearcherDirect({
    region,
    endpoint,
    indexName,
    username,
    password,
  });
}
