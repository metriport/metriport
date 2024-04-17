import { OutboundDocumentRetrievalReq } from "@metriport/ihe-gateway-sdk";
import { makeLambdaClient } from "../../../aws/lambda";
import { Config } from "../../../../util/config";
import { processAsyncError } from "../../../../util/error/shared";

export type GirthDQDRequestParams = {
  patientId: string;
  cxId: string;
  drRequestGirth: OutboundDocumentRetrievalReq;
};

const GirthOutboundDocumentRetrievalLambdaName = "GirthOutboundDocumentRetrievalLambda";

export async function startDocumentRetrievalGirth({
  drRequestsGirth,
  patientId,
  cxId,
}: {
  drRequestsGirth: OutboundDocumentRetrievalReq[];
  patientId: string;
  cxId: string;
}): Promise<void> {
  const lambdaClient = makeLambdaClient(Config.getAWSRegion());
  const params = { patientId, cxId, drRequestsGirth };
  lambdaClient
    .invoke({
      FunctionName: GirthOutboundDocumentRetrievalLambdaName,
      InvocationType: "Event",
      Payload: JSON.stringify(params),
    })
    .promise()
    .catch(processAsyncError("Failed to invoke girth lambda for document retrieval"));
}
