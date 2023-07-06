import { SidechainFHIRConverterConnector } from "./connector";
import { SidechainFHIRConverterConnectorSQS } from "./connector-sqs";

export function makeSidechainFHIRConverterConnector(): SidechainFHIRConverterConnector {
  return new SidechainFHIRConverterConnectorSQS();
}
