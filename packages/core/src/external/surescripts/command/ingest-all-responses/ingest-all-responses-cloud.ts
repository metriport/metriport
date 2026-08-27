import { executeWithNetworkRetries } from "@metriport/shared";
import { Config } from "../../../../util/config";
import { getLambdaResultPayload, makeLambdaClient } from "../../../aws/lambda";
import {
  SurescriptsIngestAllResponsesHandler,
  SurescriptsIngestAllResponsesParams,
} from "./ingest-all-responses";

export class SurescriptsIngestAllResponsesHandlerCloud
  implements SurescriptsIngestAllResponsesHandler
{
  constructor(
    private readonly lambdaClient = makeLambdaClient(Config.getAWSRegion()),
    private readonly lambdaName: string = Config.getSurescriptsIngestAllResponsesLambdaName()
  ) {}

  async ingestAllResponses(params?: SurescriptsIngestAllResponsesParams): Promise<void> {
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
