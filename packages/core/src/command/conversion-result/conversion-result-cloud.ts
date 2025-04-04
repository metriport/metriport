import { errorToString } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { SQSClient } from "../../external/aws/sqs";
import { out } from "../../util/log";
import { capture } from "../../util/notifications";
import { ConversionResult, ConversionResultHandler } from "./types";

export class ConversionResultCloud implements ConversionResultHandler {
  private readonly sqsClient: SQSClient;

  constructor(readonly region: string, private readonly conversionResultQueueUrl: string) {
    this.sqsClient = new SQSClient({ region });
  }

  async notifyApi(params: ConversionResult, logParam?: typeof console.log): Promise<void> {
    const { cxId, jobId } = params;
    const { log } = logParam
      ? { log: logParam }
      : out(`notifyApi.cloud - cxId ${cxId} jobId ${jobId}`);
    try {
      const payload = JSON.stringify(params);
      await this.sqsClient.sendMessageToQueue(this.conversionResultQueueUrl, payload, {
        fifo: true,
        messageDeduplicationId: createUuidFromText(payload),
        messageGroupId: cxId,
      });
    } catch (error) {
      const msg = `Failure while processing conversion result @ ConversionResult`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          cxId,
          jobId,
          context: "conversion-result-cloud.notifyApi",
          error,
        },
      });
      throw error;
    }
  }
}
