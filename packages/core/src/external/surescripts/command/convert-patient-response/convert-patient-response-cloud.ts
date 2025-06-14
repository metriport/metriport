import { Config } from "../../../../util/config";
import { getLambdaResultPayload, makeLambdaClient } from "../../../aws/lambda";
import { SurescriptsFileIdentifier } from "../../types";
import { SurescriptsConvertPatientResponseHandler } from "./convert-patient-response";

const region = Config.getAWSRegion();
const lambdaClient = makeLambdaClient(region);

export class SurescriptsConvertPatientResponseHandlerCloud
  implements SurescriptsConvertPatientResponseHandler
{
  constructor(private readonly surescriptsConvertPatientResponseLambdaName: string) {}

  async convertPatientResponse({ transmissionId, populationId }: SurescriptsFileIdentifier) {
    const payload = JSON.stringify({ transmissionId, populationId });
    try {
      const result = await lambdaClient
        .invoke({
          FunctionName: this.surescriptsConvertPatientResponseLambdaName,
          InvocationType: "RequestResponse",
          Payload: payload,
        })
        .promise();

      const resultPayload = getLambdaResultPayload({
        result,
        lambdaName: this.surescriptsConvertPatientResponseLambdaName,
      });
      return JSON.parse(resultPayload.toString());
    } catch (error) {
      throw new Error(
        `Failed to convert patient response ${this.surescriptsConvertPatientResponseLambdaName}: ${error}`
      );
    }
  }
}
