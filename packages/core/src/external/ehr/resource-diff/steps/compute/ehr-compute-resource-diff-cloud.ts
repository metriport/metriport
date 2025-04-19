import { BadRequestError, sleep } from "@metriport/shared";
import { chunk, partition } from "lodash";
import { Config } from "../../../../../util/config";
import { SQSClient } from "../../../../aws/sqs";
import {
  ComputeResourceDiffRequests,
  EhrComputeResourceDiffHandler,
} from "./ehr-compute-resource-diff";

export const MAX_SQS_MESSAGE_SIZE = 256000;
const MAX_SQS_MESSAGE_BATCH_SIZE = 100;
const MAX_SQS_MESSAGE_BATCH_SIZE_TO_SLEEP = 1000;

export class EhrComputeResourceDiffCloud implements EhrComputeResourceDiffHandler {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly ehrComputeResourceDiffQueueUrl: string,
    region?: string,
    sqsClient?: SQSClient
  ) {
    this.sqsClient = sqsClient ?? new SQSClient({ region: region ?? Config.getAWSRegion() });
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
    const invalidPayload = payloadsStillTooBig[0];
    if (invalidPayload) {
      throw new BadRequestError("Payload size exceeds SQS message size limit", undefined, {
        cxId: invalidPayload.cxId,
        practiceId: invalidPayload.practiceId,
        metriportPatientId: invalidPayload.metriportPatientId,
        ehrPatientId: invalidPayload.ehrPatientId,
        resourceId: invalidPayload.newResource.id,
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
