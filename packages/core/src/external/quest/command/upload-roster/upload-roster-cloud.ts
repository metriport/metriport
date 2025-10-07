import { getLambdaResultPayload, makeLambdaClient } from "../../../aws/lambda";
import { Config } from "../../../../util/config";
import { QuestUploadRosterHandler } from "./upload-roster";
import { QuestRosterType } from "../../types";

export class QuestUploadRosterHandlerCloud implements QuestUploadRosterHandler {
  constructor(
    private readonly lambdaClient = makeLambdaClient(Config.getAWSRegion()),
    private readonly lambdaName: string = Config.getQuestUploadRosterLambdaName()
  ) {}

  async generateAndUploadLatestQuestRoster({
    rosterType,
  }: {
    rosterType: QuestRosterType;
  }): Promise<void> {
    const result = await this.lambdaClient
      .invoke({
        FunctionName: this.lambdaName,
        InvocationType: "Event",
        Payload: JSON.stringify({
          rosterType,
        }),
      })
      .promise();

    // Throws an error if the Lambda was not successfully triggered.
    getLambdaResultPayload({ result, lambdaName: this.lambdaName, failOnEmptyResponse: false });
  }
}
