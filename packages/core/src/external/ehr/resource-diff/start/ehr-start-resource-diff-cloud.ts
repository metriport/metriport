import { createUuidFromText } from "@metriport/shared/common/uuid";
import { Config } from "../../../../util/config";
import { SQSClient } from "../../../aws/sqs";
import { EhrStartResourceDiffHandler, StartResourceDiffRequest } from "./ehr-start-resource-diff";

export class EhrStartResourceDiffCloud implements EhrStartResourceDiffHandler {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly ehrStartResourceDiffQueueUrl: string,
    region?: string,
    sqsClient?: SQSClient
  ) {
    if (!sqsClient) {
      this.sqsClient = new SQSClient({ region: region ?? Config.getAWSRegion() });
    } else {
      this.sqsClient = sqsClient;
    }
  }

  async startResourceDiff(params: StartResourceDiffRequest): Promise<void> {
    const { cxId } = params;
    const payload = JSON.stringify(params);
    await this.sqsClient.sendMessageToQueue(this.ehrStartResourceDiffQueueUrl, payload, {
      fifo: true,
      messageDeduplicationId: createUuidFromText(payload),
      messageGroupId: cxId,
    });
  }
}
