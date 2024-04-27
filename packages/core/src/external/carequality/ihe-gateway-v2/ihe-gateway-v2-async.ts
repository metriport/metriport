import { OutboundPatientDiscoveryReq } from "@metriport/ihe-gateway-sdk";
import { makeLambdaClient } from "../../aws/lambda";
import { Config } from "../../../util/config";
import { processAsyncError } from "../../../util/error/shared";
import { IHEGatewayV2 } from "./ihe-gateway-v2";

const iheGatewayV2OutboundPatientDiscoveryLambdaName = "IHEGatewayV2OutboundPatientDiscoveryLambda";
export class IHEGatewayV2Async extends IHEGatewayV2 {
  constructor() {
    super();
  }

  async startPatientDiscovery({
    pdRequestGatewayV2,
    patientId,
    cxId,
  }: {
    pdRequestGatewayV2: OutboundPatientDiscoveryReq;
    patientId: string;
    cxId: string;
  }): Promise<void> {
    const lambdaClient = makeLambdaClient(Config.getAWSRegion());
    const params = { patientId, cxId, pdRequestGatewayV2 };
    // intentionally not waiting
    lambdaClient
      .invoke({
        FunctionName: iheGatewayV2OutboundPatientDiscoveryLambdaName,
        InvocationType: "Event",
        Payload: JSON.stringify(params),
      })
      .promise()
      .catch(
        processAsyncError("Failed to invoke lambda to poll outbound patient discovery responses")
      );
  }
}
