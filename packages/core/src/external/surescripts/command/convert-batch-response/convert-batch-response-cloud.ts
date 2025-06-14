import { Bundle } from "@medplum/fhirtypes";
import { Config } from "../../../../util/config";
import { getLambdaResultPayload, makeLambdaClient } from "../../../aws/lambda";
import { SurescriptsFileIdentifier } from "../../types";
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
  }: SurescriptsFileIdentifier): Promise<Bundle[]> {
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
      return JSON.parse(resultPayload.toString()) as Bundle[];
    } catch (error) {
      throw new Error(
        `Failed to convert batch response ${this.surescriptsConvertBatchResponseLambdaName}: ${error}`
      );
    }
  }
}
