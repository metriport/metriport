import { OutboundDocumentQueryReq } from "@metriport/ihe-gateway-sdk";
import { makeLambdaClient } from "../../../aws/lambda";
import { Config } from "../../../../util/config";

export type GirthDQDRequestParams = {
  patientId: string;
  cxId: string;
  dqRequestGirth: OutboundDocumentQueryReq;
};

export async function startDocumentQueryGirth({
  dqRequestGirth,
  patientId,
  cxId,
}: {
  dqRequestGirth: OutboundDocumentQueryReq[];
  patientId: string;
  cxId: string;
}): Promise<void> {
  const lambdaClient = makeLambdaClient(Config.getAWSRegion());
  const params = { patientId, cxId, dqRequestGirth };
  lambdaClient.invoke({
    FunctionName: "GirthOutboundDocumentQueryLambda",
    InvocationType: "Event",
    Payload: JSON.stringify(params),
  });
}
