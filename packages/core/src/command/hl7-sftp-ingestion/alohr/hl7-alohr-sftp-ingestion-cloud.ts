import { getLambdaResultPayload, makeLambdaClient } from "../../../external/aws/lambda";
import { Config } from "../../../util/config";
import { Hl7AlohrSftpIngestion, Hl7AlohrSftpIngestionParams } from "./hl7-alohr-sftp-ingestion";

export class Hl7AlohrSftpIngestionCloud implements Hl7AlohrSftpIngestion {
  constructor(
    private readonly lambdaClient = makeLambdaClient(Config.getAWSRegion()),
    private readonly lambdaName: string = Config.getLahieIngestionLambdaName()
  ) {}

  async execute(params: Hl7AlohrSftpIngestionParams): Promise<void> {
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
