import { getLambdaResultPayload, makeLambdaClient } from "../../../aws/lambda";
import { Config } from "../../../../util/config";
import { DownloadResponseCommandHandler } from "./download-response";

export class QuestDownloadResponseHandlerCloud implements DownloadResponseCommandHandler {
  constructor(
    private readonly lambdaClient = makeLambdaClient(Config.getAWSRegion()),
    private readonly lambdaName: string = Config.getQuestUploadRosterLambdaName()
  ) {}

  async downloadAllQuestResponses(): Promise<void> {
    const result = await this.lambdaClient
      .invoke({
        FunctionName: this.lambdaName,
        InvocationType: "Event",
        Payload: JSON.stringify({}),
      })
      .promise();

    // Throws an error if the Lambda was not successfully triggered.
    getLambdaResultPayload({ result, lambdaName: this.lambdaName, failOnEmptyResponse: false });
  }
}
