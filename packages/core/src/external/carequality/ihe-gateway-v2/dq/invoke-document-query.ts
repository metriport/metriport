import { OutboundDocumentQueryReq } from "@metriport/ihe-gateway-sdk";
import { makeLambdaClient } from "../../../aws/lambda";
import { Config } from "../../../../util/config";
import { processAsyncError } from "../../../../util/error/shared";

export type GirthDQDRequestParams = {
  patientId: string;
  cxId: string;
  dqRequestGirth: OutboundDocumentQueryReq;
};

const GirthOutboundDocumentQueryLambdaName = "GirthOutboundDocumentQueryLambda";

export async function startDocumentQueryGirth({
  dqRequestsGirth,
  patientId,
  cxId,
}: {
  dqRequestsGirth: OutboundDocumentQueryReq[];
  patientId: string;
  cxId: string;
}): Promise<void> {
  const lambdaClient = makeLambdaClient(Config.getAWSRegion());
  const params = { patientId, cxId, dqRequestsGirth };
  // intentionally not waiting
  lambdaClient
    .invoke({
      FunctionName: GirthOutboundDocumentQueryLambdaName,
      InvocationType: "Event",
      Payload: JSON.stringify(params),
    })
    .promise()
    .catch(processAsyncError("Failed to invoke lambda to poll outbound document query responses"));
}
