import { Config } from "../../shared/config";
import { SidechainFHIRConverterConnector, SidechainFHIRConverterRequest } from "./connector";
import { SidechainFHIRConverterConnectorSQS } from "./connector-sqs";

export function makeSidechainFHIRConverterConnector(): SidechainFHIRConverterConnector {
  if (!Config.isCloudEnv()) return new SidechainFHIRConverterVoid();
  return new SidechainFHIRConverterConnectorSQS();
}

class SidechainFHIRConverterVoid implements SidechainFHIRConverterConnector {
  async requestConvert(params: SidechainFHIRConverterRequest): Promise<void> {
    console.log(
      `SidechainFHIRConverterVoid - Would be sending a message to SQS to convert document ${params.documentId}`,
      params
    );
    return;
  }
}
