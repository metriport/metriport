import { Config } from "../../util/config";
import { ConsolidatedDataConnector } from "./get-consolidated";
import { ConsolidatedDataConnectorLambda } from "./get-consolidated-lambda";
import { ConsolidatedDataConnectorLocal } from "./get-consolidated-local";

export function buildConsolidatedDataConnector(): ConsolidatedDataConnector {
  if (Config.isDev()) {
    const bucketName = Config.getMedicalDocumentsBucketName();
    const apiURL = Config.getApiUrl();
    return new ConsolidatedDataConnectorLocal(bucketName, apiURL);
  }
  return new ConsolidatedDataConnectorLambda();
}
