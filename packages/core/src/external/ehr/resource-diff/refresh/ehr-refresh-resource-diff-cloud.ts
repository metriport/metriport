import { createUuidFromText } from "@metriport/shared/common/uuid";
import { Config } from "../../../../util/config";
import { SQSClient } from "../../../aws/sqs";
import {
  EhrRefreshResourceDiffHandler,
  RefreshResourceDiffRequest,
} from "./ehr-refresh-resource-diff";

export class EhrRefreshResourceDiffCloud implements EhrRefreshResourceDiffHandler {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly ehrRefreshResourceDiffQueueUrl: string,
    region?: string,
    sqsClient?: SQSClient
  ) {
    if (!sqsClient) {
      this.sqsClient = new SQSClient({ region: region ?? Config.getAWSRegion() });
    } else {
      this.sqsClient = sqsClient;
    }
  }

  async refreshResourceDiff(params: RefreshResourceDiffRequest): Promise<void> {
    const { cxId } = params;
    const payload = JSON.stringify(params);
    await this.sqsClient.sendMessageToQueue(this.ehrRefreshResourceDiffQueueUrl, payload, {
      fifo: true,
      messageDeduplicationId: createUuidFromText(payload),
      messageGroupId: cxId,
    });
  }
}
