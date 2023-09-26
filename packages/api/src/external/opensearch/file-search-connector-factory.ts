import {
  FileSearchConnector,
  FileSearchConnectorDirect,
  FileSearchConnectorSQS,
} from "@metriport/core/opensearch";
import { Config } from "../../shared/config";

export function makeSearchConnector(): FileSearchConnector {
  const region = Config.getAWSRegion();
  if (!region) throw new Error(`AWS region is required`);
  const endpoint = Config.getSearchEndpoint();
  if (!endpoint) throw new Error(`Endpoint is required`);
  // TODO 1050 make these dynamic
  // TODO 1050 make these dynamic
  // TODO 1050 make these dynamic
  // TODO 1050 make these dynamic
  const indexName = "ccda-index";
  const username = "admin";
  const password = Config.getSearchPassword() ?? "";
  if (Config.isDev()) {
    return new FileSearchConnectorDirect({
      region,
      endpoint,
      indexName,
      username,
      password,
    });
  }
  return new FileSearchConnectorSQS({
    region,
    endpoint,
    indexName,
    username,
    password,
    queueUrl: Config.getSearchIngestionQueueUrl(),
  });
}
