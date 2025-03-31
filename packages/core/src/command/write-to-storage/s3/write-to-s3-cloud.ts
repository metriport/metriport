import { createUuidFromText } from "@metriport/shared/common/uuid";
import { SQSClient } from "../../../external/aws/sqs";
import { Config } from "../../../util/config";
import { S3Writer, WriteToS3Request } from "./write-to-s3";
import { BadRequestError } from "@metriport/shared";

const MAX_SQS_MESSAGE_SIZE = 256000;

/** ---------------------------------------------------------------------------
 * This class is used to write to S3 in a cloud environment via SQS. The max
 * payload size is 256KB.
 */
export class S3WriterCloud implements S3Writer {
  private readonly sqsClient: SQSClient;

  constructor(private readonly writeToS3QueueUrl: string, region?: string, sqsClient?: SQSClient) {
    if (!sqsClient) {
      this.sqsClient = new SQSClient({ region: region ?? Config.getAWSRegion() });
    } else {
      this.sqsClient = sqsClient;
    }
  }

  async writeToS3(params: WriteToS3Request): Promise<void> {
    const paylodTooBig = params.find(p => Buffer.from(p.payload).length > MAX_SQS_MESSAGE_SIZE);
    if (paylodTooBig) {
      throw new BadRequestError("Payload size exceeds SQS message size limit", undefined, {
        bucket: paylodTooBig.bucket,
        filePath: paylodTooBig.filePath,
        fileName: paylodTooBig.fileName,
      });
    }
    await Promise.all(
      params.map(p =>
        this.sqsClient.sendMessageToQueue(this.writeToS3QueueUrl, p.payload, {
          fifo: true,
          messageDeduplicationId: createUuidFromText(p.payload),
          messageGroupId: p.serviceId,
        })
      )
    );
  }
}
