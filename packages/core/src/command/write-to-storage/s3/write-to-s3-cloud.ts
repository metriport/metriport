import { errorToString } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { SQSClient } from "../../../external/aws/sqs";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { ProcessWriteToS3Handler, ProcessWriteToS3Request } from "./write-to-s3";

const region = Config.getAWSRegion();
const sqsClient = new SQSClient({ region });

export class ProcessWriteToS3Cloud implements ProcessWriteToS3Handler {
  constructor(private readonly writeToS3QueueUrl: string) {}

  async processWriteToS3(params: ProcessWriteToS3Request): Promise<void> {
    const { serviceId, bucket, filePath, key } = params;
    const { log } = out(
      `processWriteToS3.cloud - serviceId ${serviceId} destination ${`${bucket}/${filePath}/${
        key ?? "unknown"
      }`}`
    );
    try {
      const payload = JSON.stringify(params);
      await sqsClient.sendMessageToQueue(this.writeToS3QueueUrl, payload, {
        fifo: true,
        messageDeduplicationId: createUuidFromText(payload),
        messageGroupId: serviceId,
      });
    } catch (error) {
      const msg = `Failure while processing patient create @ PatientImport`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          serviceId,
          bucket,
          context: "write-to-s3-cloud.processWriteToS3",
          error,
        },
      });
      throw error;
    }
  }
}
