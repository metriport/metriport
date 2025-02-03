import { Config } from "../../util/config";
import { ConsolidatedSnapshotConnector } from "./get-snapshot";
import { ConsolidatedSnapshotConnectorLambda } from "./get-snapshot-lambda";
import { ConsolidatedSnapshotConnectorLocal } from "./get-snapshot-local";

export function buildConsolidatedSnapshotConnector(): ConsolidatedSnapshotConnector {
  if (!Config.isCloudEnv()) {
    const bucketName = Config.getMedicalDocumentsBucketName();
    const apiURL = Config.getApiUrl();
    return new ConsolidatedSnapshotConnectorLocal(bucketName, apiURL);
  }
  return new ConsolidatedSnapshotConnectorLambda();
}
