import { BadRequestError, sleep } from "@metriport/shared";
import { chunk } from "lodash";
import { Config } from "../../../../../util/config";
import { SQSClient } from "../../../../aws/sqs";
import {
  ComputeResourceDiffRequests,
  EhrComputeResourceDiffHandler,
} from "./ehr-compute-resource-diff";

const MAX_SQS_MESSAGE_SIZE = 256000;
const MAX_SQS_MESSAGE_BATCH_SIZE = 100;
const MAX_SQS_MESSAGE_BATCH_SIZE_TO_SLEEP = 1000;

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
    const paylodTooBig = params.find(
      p => Buffer.from(JSON.stringify(p)).length > MAX_SQS_MESSAGE_SIZE
    );
    if (paylodTooBig) {
      throw new BadRequestError("Payload size exceeds SQS message size limit", undefined, {
        cxId: paylodTooBig.cxId,
        practiceId: paylodTooBig.practiceId,
        metriportPatientId: paylodTooBig.metriportPatientId,
        ehrPatientId: paylodTooBig.ehrPatientId,
        resourceId: paylodTooBig.newResource.id,
      });
    }
    const chunks = chunk(params, MAX_SQS_MESSAGE_BATCH_SIZE);
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
