import { Config } from "../../../shared/config";
import { FHIRServerConnector } from "./connector";
import { FHIRServerConnectorHTTP } from "./connector-http";
import { FHIRServerConnectorSQS } from "./connector-sqs";

export function makeFHIRServerConnector(): FHIRServerConnector {
  if (!Config.isCloudEnv()) return new FHIRServerConnectorHTTP();
  return new FHIRServerConnectorSQS();
}
