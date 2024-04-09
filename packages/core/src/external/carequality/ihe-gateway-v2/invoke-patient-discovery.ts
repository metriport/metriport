import { OutboundPatientDiscoveryReq } from "@metriport/ihe-gateway-sdk";
import { makeLambdaClient } from "../../aws/lambda";
import { Config } from "../../../util/config";

export type GirthXCPDRequestParams = {
  patientId: string;
  cxId: string;
  pdRequestGirth: OutboundPatientDiscoveryReq;
};

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
  await lambdaClient
    .invoke({
      FunctionName: Config.getGirthPatientDiscoveryLambdaName(),
      InvocationType: "Event",
      Payload: JSON.stringify(params),
    })
    .promise();
}
