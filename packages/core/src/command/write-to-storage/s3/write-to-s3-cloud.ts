import { createUuidFromText } from "@metriport/shared/common/uuid";
import { SQSClient } from "../../../external/aws/sqs";
import { Config } from "../../../util/config";
import { S3Writer, WriteToS3Request } from "./write-to-s3";

/** ---------------------------------------------------------------------------
 * This class is used to write to S3 in a cloud environment via SQS. The max
 * payload size is 256KB.
 */
export class S3WriterCloud implements S3Writer {
  private readonly sqsClient: SQSClient;

  constructor(private readonly writeToS3QueueUrl: string) {
    const region = Config.getAWSRegion();
    this.sqsClient = new SQSClient({ region });
  }

  async writeToS3(params: WriteToS3Request): Promise<void> {
    await Promise.all(
      params.map(p => {
        this.sqsClient.sendMessageToQueue(this.writeToS3QueueUrl, p.payload, {
          fifo: true,
          messageDeduplicationId: createUuidFromText(p.payload),
          messageGroupId: p.serviceId,
        });
      })
    );
  }
}
