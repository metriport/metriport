import { errorToString } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { SQSClient } from "../../../external/aws/sqs";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { EhrSyncPatientHandler, ProcessSyncPatientRequest } from "./ehr-sync-patient";

const region = Config.getAWSRegion();
const sqsClient = new SQSClient({ region });

export class EhrSyncPatientCloud implements EhrSyncPatientHandler {
  constructor(private readonly ehrSyncPatientQueueUrl: string) {}

  async processSyncPatient(params: ProcessSyncPatientRequest): Promise<void> {
    const { ehr, cxId, practiceId, patientId, triggerDq } = params;
    const { log } = out(
      `processSyncPatient.cloud - ehr ${ehr} cxId ${cxId} practiceId ${practiceId} patientId ${patientId}`
    );
    try {
      const payload = JSON.stringify(params);
      await sqsClient.sendMessageToQueue(this.ehrSyncPatientQueueUrl, payload, {
        fifo: true,
        messageDeduplicationId: createUuidFromText(payload),
        messageGroupId: cxId,
      });
    } catch (error) {
      const msg = `Failure while processing patient sync @ Ehr`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          ehr,
          cxId,
          practiceId,
          patientId,
          triggerDq,
          context: "ehr-sync-patient-cloud.processSyncPatient",
          error,
        },
      });
      throw error;
    }
  }
}
