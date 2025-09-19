import { getLambdaResultPayload, makeLambdaClient } from "../../external/aws/lambda";
import { Config } from "../../util/config";
import { Hl7LahieSftpIngestion, Hl7LahieSftpIngestionParams } from "./hl7-sftp-ingestion";

export class Hl7LahieSftpIngestionCloud implements Hl7LahieSftpIngestion {
  constructor(
    private readonly lambdaClient = makeLambdaClient(Config.getAWSRegion()),
    private readonly lambdaName: string = Config.getLahieIngestionLambdaName()
  ) {}

  async execute(params: Hl7LahieSftpIngestionParams): Promise<void> {
    const result = await this.lambdaClient
      .invoke({
        FunctionName: this.lambdaName,
        InvocationType: "Event",
        Payload: JSON.stringify(params),
      })
      .promise();

    // Throws an error if the Lambda was not successfully triggered.
    getLambdaResultPayload({ result, lambdaName: this.lambdaName, failOnEmptyResponse: false });
  }
}
