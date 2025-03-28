import { createUuidFromText } from "@metriport/shared/common/uuid";
import { SQSClient } from "../../../external/aws/sqs";
import { Config } from "../../../util/config";
import { ProcessWriteToS3Handler, ProcessWriteToS3Request } from "./write-to-s3";

const region = Config.getAWSRegion();
const sqsClient = new SQSClient({ region });

export class ProcessWriteToS3Cloud implements ProcessWriteToS3Handler {
  constructor(private readonly writeToS3QueueUrl: string) {}

  async processWriteToS3(params: ProcessWriteToS3Request): Promise<void> {
    const { serviceId } = params;
    const payload = JSON.stringify(params);
    await sqsClient.sendMessageToQueue(this.writeToS3QueueUrl, payload, {
      fifo: true,
      messageDeduplicationId: createUuidFromText(payload),
      messageGroupId: serviceId,
    });
  }
}
