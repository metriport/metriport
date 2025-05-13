import { OpenSearchFileIngestor } from "./file-ingestor";
import { OpenSearchFileIngestorDirect } from "./file-ingestor-direct";
import { OpenSearchFileIngestorSQS } from "./file-ingestor-sqs";
import { OpenSearchFileSearcher } from "./file-searcher";
import { OpenSearchFileSearcherDirect } from "./file-searcher-direct";
import { OpenSearchFileRemoverDirect } from "./file-remover-direct";
import { OpenSearchFileRemover } from "./file-remover";
import { Config } from "../../../util/config";

export function makeSearchServiceIngest(): OpenSearchFileIngestor {
  const region = Config.getAWSRegion();
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

export function makeSearchServiceRemover(): OpenSearchFileRemover {
  const region = Config.getAWSRegion();
  const endpoint = Config.getSearchEndpoint();
  const indexName = Config.getSearchIndexName();
  const username = Config.getSearchUsername();
  const password = Config.getSearchPassword();

  return new OpenSearchFileRemoverDirect({
    region,
    endpoint,
    indexName,
    username,
    password,
  });
}
