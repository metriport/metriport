import { BadRequestError, executeWithNetworkRetries } from "@metriport/shared";
import { SQSClient } from "../../../../external/aws/sqs";
import { Config } from "../../../../util/config";
import { SnowflakeIngestor, SnowflakeIngestorRequest } from "./snowflake-ingestor";

const sharedGlobalGroupId = "shared-global-group";

export class SnowflakeIngestorCloud extends SnowflakeIngestor {
  constructor(
    private readonly snowflakeConnectorQueueUrl: string = Config.getSnowflakeConnectorQueueUrl(),
    private readonly sqsClient: SQSClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {
    super();
  }

  async ingestCoreIntoSnowflake(params: SnowflakeIngestorRequest): Promise<void> {
    const { cxId, forceSynchronous: forceSync } = params;
    const payload: SnowflakeIngestorRequest = { cxId };
    const payloadString = JSON.stringify(payload);

    if (forceSync) throw new BadRequestError(`Force sync is not supported for cloud ingestion`);

    await executeWithNetworkRetries(async () => {
      await this.sqsClient.sendMessageToQueue(this.snowflakeConnectorQueueUrl, payloadString, {
        fifo: true,
        messageDeduplicationId: cxId,
        messageGroupId: sharedGlobalGroupId,
      });
    });
  }
}
