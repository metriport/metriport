import { executeWithNetworkRetries } from "@metriport/shared";
import { SQSClient } from "../../../../external/aws/sqs";
import { Config } from "../../../../util/config";
import { CoreTransformHandler, ProcessCoreTransformRequest } from "./core-transform";

export class CoreTransformCloud extends CoreTransformHandler {
  constructor(
    private readonly coreTransformQueueUrl: string = Config.getCoreTransformQueueUrl(),
    private readonly sqsClient: SQSClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {
    super();
  }

  async processCoreTransform(params: ProcessCoreTransformRequest): Promise<void> {
    const { cxId } = params;
    const payload: ProcessCoreTransformRequest = params;
    const payloadStrig = JSON.stringify(payload);

    await executeWithNetworkRetries(async () => {
      await this.sqsClient.sendMessageToQueue(this.coreTransformQueueUrl, payloadStrig, {
        fifo: true,
        messageDeduplicationId: cxId,
        messageGroupId: cxId,
      });
    });
  }
}
