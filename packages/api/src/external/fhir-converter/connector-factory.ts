import { Config } from "../../shared/config";
import { FHIRConverterConnector } from "./connector";
import { FHIRConverterConnectorHTTP } from "./connector-http";
import { FHIRConverterConnectorSQS } from "./connector-sqs";

export function makeFHIRConverterConnector(): FHIRConverterConnector {
  if (!Config.isCloudEnv()) return new FHIRConverterConnectorHTTP();
  return new FHIRConverterConnectorSQS();
}
