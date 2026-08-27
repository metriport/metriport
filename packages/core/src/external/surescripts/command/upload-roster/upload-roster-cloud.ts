import { Config } from "../../../../util/config";
import { getLambdaResultPayload, makeLambdaClient } from "../../../aws/lambda";
import { SurescriptsRosterRequest, SurescriptsUploadRosterHandler } from "./upload-roster";

export class SurescriptsUploadRosterHandlerCloud implements SurescriptsUploadRosterHandler {
  constructor(
    private readonly lambdaClient = makeLambdaClient(Config.getAWSRegion()),
    private readonly lambdaName: string = Config.getSurescriptsUploadRosterLambdaName()
  ) {}

  async uploadRoster(request: SurescriptsRosterRequest): Promise<void> {
    const result = await this.lambdaClient
      .invoke({
        FunctionName: this.lambdaName,
        InvocationType: "Event",
        Payload: JSON.stringify(request),
      })
      .promise();

    // Throws an error if the Lambda was not successfully triggered.
    getLambdaResultPayload({ result, lambdaName: this.lambdaName, failOnEmptyResponse: false });
  }
}
