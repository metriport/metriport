import { BadRequestError, sleep } from "@metriport/shared";
import { chunk, partition } from "lodash";
import { Config } from "../../../../../util/config";
import {
  MAX_SQS_MESSAGE_BATCH_SIZE,
  MAX_SQS_MESSAGE_BATCH_SIZE_TO_SLEEP,
  MAX_SQS_MESSAGE_SIZE,
} from "../../../../../util/sqs";
import { SQSClient } from "../../../../aws/sqs";
import {
  ComputeResourceDiffRequests,
  EhrComputeResourceDiffHandler,
} from "./ehr-compute-resource-diff";

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

  async computeResourceDiff(params: ComputeResourceDiffRequests): Promise<void> {
    const [payloadsTooBig, payloadsOkay] = partition(
      params,
      p => Buffer.from(JSON.stringify(p)).length > MAX_SQS_MESSAGE_SIZE
    );
    const payloadsTooBigWithoutResources = payloadsTooBig.map(p => ({
      ...p,
      existingResources: undefined,
    }));
    const [payloadsStillTooBig, payloadsOkayWithoutResources] = partition(
      payloadsTooBigWithoutResources,
      p => Buffer.from(JSON.stringify(p)).length > MAX_SQS_MESSAGE_SIZE
    );
    const badPayload = payloadsStillTooBig[0];
    if (badPayload) {
      throw new BadRequestError("Payload size exceeds SQS message size limit", undefined, {
        cxId: badPayload.cxId,
        practiceId: badPayload.practiceId,
        metriportPatientId: badPayload.metriportPatientId,
        ehrPatientId: badPayload.ehrPatientId,
        resourceId: badPayload.newResource.id,
      });
    }
    const chunks = chunk(
      [...payloadsOkay, ...payloadsOkayWithoutResources],
      MAX_SQS_MESSAGE_BATCH_SIZE
    );
    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(p =>
          this.sqsClient.sendMessageToQueue(this.ehrComputeResourceDiffQueueUrl, JSON.stringify(p))
        )
      );
      await sleep(MAX_SQS_MESSAGE_BATCH_SIZE_TO_SLEEP);
    }
  }
}
