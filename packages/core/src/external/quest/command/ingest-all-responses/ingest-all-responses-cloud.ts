import { executeWithNetworkRetries } from "@metriport/shared";
import { Config } from "../../../../util/config";
import { getLambdaResultPayload, makeLambdaClient } from "../../../aws/lambda";
import {
  QuestIngestAllResponsesHandler,
  QuestIngestAllResponsesParams,
} from "./ingest-all-responses";

export class QuestIngestAllResponsesHandlerCloud implements QuestIngestAllResponsesHandler {
  constructor(
    private readonly lambdaClient = makeLambdaClient(Config.getAWSRegion()),
    private readonly lambdaName: string = Config.getQuestIngestAllResponsesLambdaName()
  ) {}

  async ingestAllResponses(params?: QuestIngestAllResponsesParams): Promise<void> {
    const payload = JSON.stringify(params ?? {});
    return await executeWithNetworkRetries(async () => {
      const result = await this.lambdaClient
        .invoke({
          FunctionName: this.lambdaName,
          InvocationType: "Event",
          Payload: payload,
        })
        .promise();

      // Throws an error if the Lambda was not successfully triggered.
      getLambdaResultPayload({ result, lambdaName: this.lambdaName, failOnEmptyResponse: false });
    });
  }
}
