import { Config } from "../../../../util/config";
import { executeWithNetworkRetries } from "@metriport/shared";
import { getLambdaResultPayload, makeLambdaClient } from "../../../aws/lambda";
import { SurescriptsConversionBundle, SurescriptsJob } from "../../types";
import { SurescriptsConvertBatchResponseHandler } from "./convert-batch-response";
export class SurescriptsConvertBatchResponseHandlerCloud
  implements SurescriptsConvertBatchResponseHandler
{
  constructor(
    private readonly surescriptsConvertBatchResponseLambdaName: string,
    private readonly lambdaClient = makeLambdaClient(Config.getAWSRegion())
  ) {}

  async convertBatchResponse(job: SurescriptsJob): Promise<SurescriptsConversionBundle[]> {
    const payload = JSON.stringify(job);
    return await executeWithNetworkRetries(async () => {
      const result = await this.lambdaClient
        .invoke({
          FunctionName: this.surescriptsConvertBatchResponseLambdaName,
          InvocationType: "RequestResponse",
          Payload: payload,
        })
        .promise();

      const resultPayload = getLambdaResultPayload({
        result,
        lambdaName: this.surescriptsConvertBatchResponseLambdaName,
      });

      return JSON.parse(resultPayload) as SurescriptsConversionBundle[];
    });
  }
}
