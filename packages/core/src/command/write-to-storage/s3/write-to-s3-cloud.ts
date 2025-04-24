import { BadRequestError, sleep } from "@metriport/shared";
import { chunk } from "lodash";
import { SQSClient } from "../../../external/aws/sqs";
import { Config } from "../../../util/config";
import {
  MAX_SQS_MESSAGE_SIZE,
  SQS_MESSAGE_BATCH_MILLIS_TO_SLEEP,
  SQS_MESSAGE_BATCH_SIZE,
} from "../../../util/sqs";
import { S3Writer, WriteToS3Request } from "./write-to-s3";

/** ---------------------------------------------------------------------------
 * This class is used to write to S3 in a cloud environment via SQS. The max
 * payload size is 256KB.
 */
export class S3WriterCloud implements S3Writer {
  private readonly sqsClient: SQSClient;

  constructor(private readonly writeToS3QueueUrl: string, region?: string, sqsClient?: SQSClient) {
    this.sqsClient = sqsClient ?? new SQSClient({ region: region ?? Config.getAWSRegion() });
  }

  async writeToS3(params: WriteToS3Request): Promise<void> {
    const paylodTooBig = params.find(
      p => Buffer.from(JSON.stringify(p)).length > MAX_SQS_MESSAGE_SIZE
    );
    if (paylodTooBig) {
      throw new BadRequestError("Payload size exceeds SQS message size limit", undefined, {
        bucket: paylodTooBig.bucket,
        filePath: paylodTooBig.filePath,
        fileName: paylodTooBig.fileName,
      });
    }
    const chunks = chunk(params, SQS_MESSAGE_BATCH_SIZE);
    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(params => {
          const payload = JSON.stringify(params);
          return this.sqsClient.sendMessageToQueue(this.writeToS3QueueUrl, payload);
        })
      );
      await sleep(SQS_MESSAGE_BATCH_MILLIS_TO_SLEEP);
    }
  }
}
