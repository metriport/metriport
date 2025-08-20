import { getLambdaResultPayload, makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { Config } from "../../../../util/config";
import { QuestUploadRosterHandler } from "./upload-roster";

export class QuestUploadRosterHandlerCloud implements QuestUploadRosterHandler {
  constructor(
    private readonly lambdaClient = makeLambdaClient(Config.getAWSRegion()),
    private readonly lambdaName: string = Config.getQuestUploadRosterLambdaName()
  ) {}

  async generateAndUploadLatestQuestRoster(): Promise<void> {
    const result = await this.lambdaClient
      .invoke({
        FunctionName: this.lambdaName,
        InvocationType: "Event",
        Payload: JSON.stringify({}),
      })
      .promise();

    getLambdaResultPayload({ result, lambdaName: this.lambdaName, failOnEmptyResponse: false });
  }
}
