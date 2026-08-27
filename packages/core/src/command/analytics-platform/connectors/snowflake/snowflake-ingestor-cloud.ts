import { SQSClient } from "../../../../external/aws/sqs";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { SnowflakeIngestor, SnowflakeIngestorRequest } from "./snowflake-ingestor";

export class SnowflakeIngestorCloud extends SnowflakeIngestor {
  constructor(
    private readonly snowflakeConnectorQueueUrl: string = Config.getSnowflakeConnectorQueueUrl(),
    private readonly sqsClient: SQSClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {
    super();
  }

  async ingestCoreIntoSnowflake(params: SnowflakeIngestorRequest): Promise<string> {
    const { cxId, coreExportJobId, jobId: jobIdParam } = params;
    const jobId = jobIdParam || this.generateJobId();
    const { log } = out(`SnowflakeIngestorCloud - cx ${cxId}, job ${jobId}`);

    const payload: SnowflakeIngestorRequest = { cxId, coreExportJobId, jobId };
    const payloadString = JSON.stringify(payload);

    log(`Requesting ingestion of core data into Snowflake`);

    await this.sqsClient.sendMessageToQueue(this.snowflakeConnectorQueueUrl, payloadString, {
      fifo: true,
      messageDeduplicationId: jobId,
      messageGroupId: cxId,
    });

    return jobId;
  }
}
