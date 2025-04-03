import { errorToString } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { SQSClient } from "../../../external/aws/sqs";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { EhrResourceDifftHandler, ProcessResourceDiffRequest } from "./ehr-resource-diff";

const region = Config.getAWSRegion();
const sqsClient = new SQSClient({ region });

export class EhrResourceDiffCloud implements EhrResourceDifftHandler {
  constructor(private readonly ehrResourceDiffQueueUrl: string) {}

  async processResourceDiff(params: ProcessResourceDiffRequest): Promise<void> {
    const { ehr, cxId, patientId, newResource } = params;
    const { log } = out(
      `processResourceDiff.cloud - ehr ${ehr} cxId ${cxId} patientId ${patientId} resourceId ${newResource.id}`
    );
    try {
      const payload = JSON.stringify(params);
      await sqsClient.sendMessageToQueue(this.ehrResourceDiffQueueUrl, payload, {
        fifo: true,
        messageDeduplicationId: createUuidFromText(payload),
        messageGroupId: cxId,
      });
    } catch (error) {
      const msg = `Failure while processing resource diff @ Ehr`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          ehr,
          cxId,
          patientId,
          resourceId: newResource.id,
          context: "ehr-resource-diff-cloud.processResourceDiff",
          error,
        },
      });
      throw error;
    }
  }
}
