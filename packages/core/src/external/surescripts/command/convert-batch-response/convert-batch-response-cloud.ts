import { Config } from "../../../../util/config";
import { getLambdaResultPayload, makeLambdaClient } from "../../../aws/lambda";
import { SurescriptsConversionBundle, SurescriptsFileIdentifier } from "../../types";
import { SurescriptsConvertBatchResponseHandler } from "./convert-batch-response";

const region = Config.getAWSRegion();
const lambdaClient = makeLambdaClient(region);

export class SurescriptsConvertBatchResponseHandlerCloud
  implements SurescriptsConvertBatchResponseHandler
{
  constructor(private readonly surescriptsConvertBatchResponseLambdaName: string) {}

  async convertBatchResponse({
    transmissionId,
    populationId,
  }: SurescriptsFileIdentifier): Promise<SurescriptsConversionBundle[]> {
    const payload = JSON.stringify({ transmissionId, populationId });
    try {
      const result = await lambdaClient
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
      const { conversionBundles } = JSON.parse(resultPayload.toString());
      if (Array.isArray(conversionBundles)) {
        return conversionBundles as SurescriptsConversionBundle[];
      }
      return [];
    } catch (error) {
      throw new Error(
        `Failed to convert batch response ${this.surescriptsConvertBatchResponseLambdaName}: ${error}`
      );
    }
  }
}
