import { OutboundPatientDiscoveryReq } from "@metriport/ihe-gateway-sdk";
import { makeLambdaClient } from "../../../aws/lambda";
import { Config } from "../../../../util/config";
import { processAsyncError } from "../../../../util/error/shared";

export type GirthXCPDRequestParams = {
  patientId: string;
  cxId: string;
  pdRequestGirth: OutboundPatientDiscoveryReq;
};
const girthOutboundPatientDiscoveryLambdaName = "GirthOutboundPatientDiscoveryLambda";

export async function startPatientDiscoveryGirth({
  pdRequestGirth,
  patientId,
  cxId,
}: {
  pdRequestGirth: OutboundPatientDiscoveryReq;
  patientId: string;
  cxId: string;
}): Promise<void> {
  const lambdaClient = makeLambdaClient(Config.getAWSRegion());
  const params = { patientId, cxId, pdRequestGirth };
  console.log(
    `Invoking Girth Outbound Patient Discovery Lambda with params: ${JSON.stringify(params)}`
  );
  // intentionally not waiting
  lambdaClient
    .invoke({
      FunctionName: girthOutboundPatientDiscoveryLambdaName,
      InvocationType: "Event",
      Payload: JSON.stringify(params),
    })
    .promise()
    .catch(
      processAsyncError("Failed to invoke lambda to poll outbound patient discovery responses")
    );
  console.log("Lambda invoked");
}
