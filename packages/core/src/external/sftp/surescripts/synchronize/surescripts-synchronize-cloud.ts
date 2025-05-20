import { Config } from "../../../../util/config";
import * as AWS from "aws-sdk";
import { makeLambdaClient } from "../../../aws/lambda";
import {
  SurescriptsSynchronizeHandler,
  ProcessSynchronizeRequest,
} from "./surescripts-synchronize";

export class SurescriptsSynchronizeCloud implements SurescriptsSynchronizeHandler {
  private readonly lambdaClient: AWS.Lambda;

  constructor(
    private readonly surescriptsSynchronizeLambdaName: string,
    region?: string,
    lambdaClient?: AWS.Lambda
  ) {
    this.lambdaClient = lambdaClient ?? makeLambdaClient(region ?? Config.getAWSRegion());
  }

  async processSynchronize(params: ProcessSynchronizeRequest): Promise<void> {
    const payload = JSON.stringify(params);
    await this.lambdaClient.invoke({
      FunctionName: this.surescriptsSynchronizeLambdaName,
      InvocationType: "Event",
      Payload: payload,
    });
    // getLambdaResultPayload({
    //   result,
    //   lambdaName: this.surescriptsSynchronizeLambdaName,
    //   failGracefully: true,
    //   failOnEmptyResponse: true,
    // });
  }
}
