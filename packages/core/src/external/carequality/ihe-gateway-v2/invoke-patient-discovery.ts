import { OutboundPatientDiscoveryReq } from "@metriport/ihe-gateway-sdk";
import { makeLambdaClient } from "../../aws/lambda";
import { Config } from "../../../util/config";
import { processAsyncError } from "../../../util/error/shared";

export type IHEGatewayV2XCPDRequestParams = {
  patientId: string;
  cxId: string;
  pdRequestIHEGatewayV2: OutboundPatientDiscoveryReq;
};
const iheGatewayV2OutboundPatientDiscoveryLambdaName = "IHEGatewayV2OutboundPatientDiscoveryLambda";

export async function startPatientDiscoveryIHEGatewayV2({
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
  console.log(
    `Invoking IHEGatewayV2 Outbound Patient Discovery Lambda with params: ${JSON.stringify(params)}`
  );
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
  console.log("Lambda invoked");
}
