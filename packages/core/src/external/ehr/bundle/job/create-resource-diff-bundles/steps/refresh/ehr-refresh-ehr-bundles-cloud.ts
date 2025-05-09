import { createUuidFromText } from "@metriport/shared/common/uuid";
import { Config } from "../../../../../../../util/config";
import { SQSClient } from "../../../../../../aws/sqs";
import { createSqsGroupId } from "../../create-resource-diff-bundle-shared";
import { EhrRefreshEhrBundlesHandler, RefreshEhrBundlesRequest } from "./ehr-refresh-ehr-bundles";

export class EhrRefreshEhrBundlesCloud implements EhrRefreshEhrBundlesHandler {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly ehrRefreshEhrBundlesQueueUrl: string,
    region: string = Config.getAWSRegion(),
    sqsClient?: SQSClient
  ) {
    this.sqsClient = sqsClient ?? new SQSClient({ region });
  }

  async refreshEhrBundles(params: RefreshEhrBundlesRequest): Promise<void> {
    const { metriportPatientId, resourceType } = params;
    const payload = JSON.stringify(params);
    await this.sqsClient.sendMessageToQueue(this.ehrRefreshEhrBundlesQueueUrl, payload, {
      fifo: true,
      messageDeduplicationId: createUuidFromText(payload),
      messageGroupId: createSqsGroupId(metriportPatientId, resourceType),
    });
  }
}
