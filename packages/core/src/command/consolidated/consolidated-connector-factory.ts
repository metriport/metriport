import { Config } from "../../util/config";
import { ConsolidatedDataConnector } from "./consolidated-connector";
import { ConsolidatedDataConnectorLambda } from "./consolidated-connector-lambda";
import { ConsolidatedDataConnectorLocal } from "./consolidated-connector-local";

export function buildConsolidatedDataConnector(): ConsolidatedDataConnector {
  if (Config.isDev()) {
    const bucketName = Config.getMedicalDocumentsBucketName();
    const apiURL = Config.getApiUrl();
    return new ConsolidatedDataConnectorLocal(bucketName, apiURL);
  }
  return new ConsolidatedDataConnectorLambda();
}
