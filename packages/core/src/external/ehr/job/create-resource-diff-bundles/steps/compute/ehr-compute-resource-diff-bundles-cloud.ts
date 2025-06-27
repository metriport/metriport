import { executeWithNetworkRetries } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { Config } from "../../../../../../util/config";
import { SQSClient } from "../../../../../aws/sqs";
import {
  ComputeResourceDiffBundlesRequest,
  EhrComputeResourceDiffBundlesHandler,
} from "./ehr-compute-resource-diff-bundles";

/**
 * This class is used to compute resource diff bundles in the cloud.
 * It sends messages to the resource diff bundle queue for each resource type.
 * The queue is configured to deduplicate messages based on the payload.
 *
 */
export class EhrComputeResourceDiffBundlesCloud implements EhrComputeResourceDiffBundlesHandler {
  constructor(
    private readonly ehrComputeResourceDiffQueueUrl: string = Config.getEhrComputeResourceDiffBundlesQueueUrl(),
    private readonly sqsClient: SQSClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {}

  async computeResourceDiffBundles(params: ComputeResourceDiffBundlesRequest): Promise<void> {
    const payload = JSON.stringify(params);
    await executeWithNetworkRetries(async () => {
      await this.sqsClient.sendMessageToQueue(this.ehrComputeResourceDiffQueueUrl, payload, {
        fifo: true,
        messageDeduplicationId: createUuidFromText(payload),
        messageGroupId: params.metriportPatientId,
      });
    });
  }
}
