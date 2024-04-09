import { OutboundDocumentRetrievalReq } from "@metriport/ihe-gateway-sdk";
import { makeLambdaClient } from "../../../aws/lambda";
import { Config } from "../../../../util/config";

export type GirthDQDRequestParams = {
  patientId: string;
  cxId: string;
  drRequestGirth: OutboundDocumentRetrievalReq;
};

export async function startDocumentRetrievalGirth({
  drRequestGirth,
  patientId,
  cxId,
}: {
  drRequestGirth: OutboundDocumentRetrievalReq;
  patientId: string;
  cxId: string;
}): Promise<void> {
  const lambdaClient = makeLambdaClient(Config.getAWSRegion());
  const params = { patientId, cxId, drRequestGirth };
  lambdaClient.invoke({
    FunctionName: "GirthOutboundDocumentRetrievalLambda",
    InvocationType: "Event",
    Payload: JSON.stringify(params),
  });
}
