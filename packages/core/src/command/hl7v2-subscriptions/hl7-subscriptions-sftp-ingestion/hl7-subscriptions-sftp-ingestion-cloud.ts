import { getLambdaResultPayload, makeLambdaClient } from "../../../external/aws/lambda";
import { Config } from "../../../util/config";
import { Hl7SubscriptionLaHieIngestion } from "./hl7-subscriptions-sftp-ingestion";

export class Hl7SubscriptionLaHieIngestionCloud implements Hl7SubscriptionLaHieIngestion {
  constructor(
    private readonly lambdaClient = makeLambdaClient(Config.getAWSRegion()),
    private readonly lambdaName: string = Config.getLaHieIngestionLambdaName()
  ) {}

  async execute(): Promise<void> {
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
