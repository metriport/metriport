import { Config } from "../../../../util/config";
import { executeWithNetworkRetries } from "@metriport/shared";
import { getLambdaResultPayload, makeLambdaClient } from "../../../aws/lambda";
import { SurescriptsReceiveAllHandler } from "./receive-all";
import { SurescriptsReceiveAllRequest, SurescriptsSftpFile } from "../../types";

const region = Config.getAWSRegion();
const lambdaClient = makeLambdaClient(region);

export class SurescriptsReceiveAllHandlerCloud implements SurescriptsReceiveAllHandler {
  constructor(private readonly surescriptsReceiveAllLambdaName: string) {}

  async receiveAllNewResponses({
    maxResponses,
  }: SurescriptsReceiveAllRequest): Promise<SurescriptsSftpFile[]> {
    const payload = JSON.stringify({ maxResponses });
    return await executeWithNetworkRetries(async () => {
      const result = await lambdaClient
        .invoke({
          FunctionName: this.surescriptsReceiveAllLambdaName,
          InvocationType: "RequestResponse",
          Payload: payload,
        })
        .promise();

      if (!result.Payload) throw new Error("No result payload");
      const resultPayload = getLambdaResultPayload({
        result,
        lambdaName: this.surescriptsReceiveAllLambdaName,
        failOnEmptyResponse: false,
      });
      if (!resultPayload) throw new Error("No result payload");
      return JSON.parse(resultPayload) as SurescriptsSftpFile[];
    });
  }
}
