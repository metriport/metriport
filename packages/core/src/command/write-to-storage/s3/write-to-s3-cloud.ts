import { createUuidFromText } from "@metriport/shared/common/uuid";
import { SQSClient } from "../../../external/aws/sqs";
import { Config } from "../../../util/config";
import { S3Writer, WriteToS3Request } from "./write-to-s3";

const region = Config.getAWSRegion();
const sqsClient = new SQSClient({ region });

/** ---------------------------------------------------------------------------
 * This class is used to write to S3 in a cloud environment via SQS. The max
 * payload size is 256KB.
 */
export class S3WriterCloud implements S3Writer {
  constructor(private readonly writeToS3QueueUrl: string) {}

  async writeToS3(params: WriteToS3Request): Promise<void> {
    const { serviceId } = params;
    const payload = JSON.stringify(params);
    await sqsClient.sendMessageToQueue(this.writeToS3QueueUrl, payload, {
      fifo: true,
      messageDeduplicationId: createUuidFromText(payload),
      messageGroupId: serviceId,
    });
  }
}
