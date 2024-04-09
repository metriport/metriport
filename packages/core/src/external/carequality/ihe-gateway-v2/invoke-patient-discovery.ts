import { OutboundPatientDiscoveryReq } from "@metriport/ihe-gateway-sdk";
import { makeLambdaClient } from "../../aws/lambda";
import { Config } from "../../../util/config";

export type GirthXCPDRequestParams = {
  patientId: string;
  cxId: string;
  pdRequestGirth: OutboundPatientDiscoveryReq;
};
const girthOutboundPatientDiscoveryLambdaName = "GirthOutboundPatientDiscoveryLambda";

// intentionally not async
export function startPatientDiscoveryGirth({
  pdRequestGirth,
  patientId,
  cxId,
}: {
  pdRequestGirth: OutboundPatientDiscoveryReq;
  patientId: string;
  cxId: string;
}): void {
  const lambdaClient = makeLambdaClient(Config.getAWSRegion());
  const params = { patientId, cxId, pdRequestGirth };
  console.log(
    `Invoking Girth Outbound Patient Discovery Lambda with params: ${JSON.stringify(params)}`
  );
  lambdaClient
    .invoke({
      FunctionName: girthOutboundPatientDiscoveryLambdaName,
      InvocationType: "Event",
      Payload: JSON.stringify(params),
    })
    .promise()
    .catch(error => console.error("Lambda invocation failed:", error));
}
