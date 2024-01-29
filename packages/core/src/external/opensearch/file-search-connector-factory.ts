import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { OpenSearchFileIngestor } from "./file-ingestor";
import { OpenSearchFileIngestorDirect } from "./file-ingestor-direct";
import { OpenSearchFileIngestorSQS } from "./file-ingestor-sqs";
import { OpenSearchFileSearcher } from "./file-searcher";
import { OpenSearchFileSearcherDirect } from "./file-searcher-direct";
import { Config } from "../../util/config";

export async function makeSearchServiceIngest(): Promise<OpenSearchFileIngestor> {
  const region = Config.getAWSRegion();
  const endpoint = Config.getSearchEndpoint();
  const indexName = Config.getSearchIndexName();
  const username = Config.getSearchUsername();
  const secretName = Config.getSearchSecretName();
  const password = (await getSecret(secretName)) as string;
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

export async function makeSearchServiceQuery(): Promise<OpenSearchFileSearcher> {
  const region = Config.getAWSRegion();
  const endpoint = "https://" + Config.getSearchEndpoint();
  const indexName = Config.getSearchIndexName();
  const username = Config.getSearchUsername();
  const secretName = Config.getSearchSecretName();
  const password = (await getSecret(secretName)) as string;
  return new OpenSearchFileSearcherDirect({
    region,
    endpoint,
    indexName,
    username,
    password,
  });
}
