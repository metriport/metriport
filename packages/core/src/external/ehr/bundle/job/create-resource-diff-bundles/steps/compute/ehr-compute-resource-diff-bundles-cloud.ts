import { executeWithNetworkRetries } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { Config } from "../../../../../../../util/config";
import { SQSClient } from "../../../../../../aws/sqs";
import { createSqsGroupId } from "../../create-resource-diff-bundle-shared";
import {
  ComputeResourceDiffBundlesRequest,
  EhrComputeResourceDiffBundlesHandler,
} from "./ehr-compute-resource-diff-bundles";

export class EhrComputeResourceDiffBundlesCloud implements EhrComputeResourceDiffBundlesHandler {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly ehrComputeResourceDiffQueueUrl: string,
    region: string = Config.getAWSRegion(),
    sqsClient?: SQSClient
  ) {
    this.sqsClient = sqsClient ?? new SQSClient({ region });
  }

  async computeResourceDiffBundles(params: ComputeResourceDiffBundlesRequest): Promise<void> {
    const { metriportPatientId, resourceType } = params;
    const payload = JSON.stringify(params);
    await executeWithNetworkRetries(async () => {
      await this.sqsClient.sendMessageToQueue(this.ehrComputeResourceDiffQueueUrl, payload, {
        fifo: true,
        messageDeduplicationId: createUuidFromText(payload),
        messageGroupId: createSqsGroupId(metriportPatientId, resourceType),
      });
    });
  }
}
