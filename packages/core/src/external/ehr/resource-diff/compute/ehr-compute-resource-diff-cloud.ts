import { BadRequestError } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { SQSClient } from "../../../aws/sqs";
import {
  ComputeResourceDiffRequest,
  EhrComputeResourceDiffHandler,
} from "./ehr-compute-resource-diff";

const MAX_SQS_MESSAGE_SIZE = 256000;

export class EhrComputeResourceDiffCloud implements EhrComputeResourceDiffHandler {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly ehrComputeResourceDiffQueueUrl: string,
    region?: string,
    sqsClient?: SQSClient
  ) {
    if (!sqsClient) {
      this.sqsClient = new SQSClient({ region: region ?? Config.getAWSRegion() });
    } else {
      this.sqsClient = sqsClient;
    }
  }

  async computeResourceDiff(params: ComputeResourceDiffRequest): Promise<void> {
    const { ehr, cxId, patientId, newResource, direction } = params;
    const { log } = out(
      `computeResourceDiff.cloud - ehr ${ehr} cxId ${cxId} patientId ${patientId} resourceId ${newResource.id} direction ${direction}`
    );
    const payloadSize = Buffer.from(JSON.stringify(params)).length;
    if (payloadSize > MAX_SQS_MESSAGE_SIZE) {
      log(`Payload size exceeds SQS message size limit`);
      throw new BadRequestError("Payload size exceeds SQS message size limit", undefined, {
        ehr,
        cxId,
        patientId,
        resourceId: newResource.id,
        direction,
      });
    }
    const payload = JSON.stringify(params);
    await this.sqsClient.sendMessageToQueue(this.ehrComputeResourceDiffQueueUrl, payload, {
      fifo: true,
      messageDeduplicationId: createUuidFromText(payload),
      messageGroupId: cxId,
    });
  }
}
