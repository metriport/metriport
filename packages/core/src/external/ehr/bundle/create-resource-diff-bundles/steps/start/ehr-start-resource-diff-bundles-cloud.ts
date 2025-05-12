import { MetriportError } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { Config } from "../../../../../../util/config";
import { SQSClient } from "../../../../../aws/sqs";
import {
  EhrStartResourceDiffBundlesHandler,
  StartResourceDiffBundlesRequest,
} from "./ehr-start-resource-diff-bundles";

export class EhrStartResourceDiffBundlesCloud implements EhrStartResourceDiffBundlesHandler {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly ehrStartResourceDiffBundlesQueueUrl: string,
    region?: string,
    sqsClient?: SQSClient
  ) {
    this.sqsClient = sqsClient ?? new SQSClient({ region: region ?? Config.getAWSRegion() });
  }

  async startResourceDiffBundlesMetriportOnly(
    params: StartResourceDiffBundlesRequest
  ): Promise<void> {
    const { cxId } = params;
    const payload = JSON.stringify(params);
    await this.sqsClient.sendMessageToQueue(this.ehrStartResourceDiffBundlesQueueUrl, payload, {
      fifo: true,
      messageDeduplicationId: createUuidFromText(payload),
      messageGroupId: cxId,
    });
  }

  async startResourceDiffBundlesEhrOnly(): Promise<void> {
    throw new MetriportError("Resource diff bundle EhrOnly is not supported");
  }
}
