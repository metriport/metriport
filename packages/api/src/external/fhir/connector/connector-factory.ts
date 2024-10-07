import { Config } from "../../../shared/config";
import { FHIRServerConnector } from "./connector";
import { FHIRServerConnectorHTTP } from "./connector-http";
import { FHIRServerConnectorSQS } from "./connector-sqs";

export function makeFHIRServerConnector(): FHIRServerConnector {
  if (Config.isDev()) return new FHIRServerConnectorHTTP();
  return new FHIRServerConnectorSQS();
}
