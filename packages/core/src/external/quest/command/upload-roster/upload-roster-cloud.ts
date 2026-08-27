import { Config } from "../../../../util/config";
import { getLambdaResultPayload, makeLambdaClient } from "../../../aws/lambda";
import { QuestRosterRequest, QuestUploadRosterHandler } from "./upload-roster";

export class QuestUploadRosterHandlerCloud implements QuestUploadRosterHandler {
  constructor(
    private readonly lambdaClient = makeLambdaClient(Config.getAWSRegion()),
    private readonly lambdaName: string = Config.getQuestUploadRosterLambdaName()
  ) {}

  async uploadRoster(rosterRequest: QuestRosterRequest): Promise<void> {
    const result = await this.lambdaClient
      .invoke({
        FunctionName: this.lambdaName,
        InvocationType: "Event",
        Payload: JSON.stringify(rosterRequest),
      })
      .promise();

    // Throws an error if the Lambda was not successfully triggered.
    getLambdaResultPayload({ result, lambdaName: this.lambdaName, failOnEmptyResponse: false });
  }
}
