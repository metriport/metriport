import { errorToString } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { capture } from "../../../../util/notifications";
import { SQSClient } from "../../../aws/sqs";
import { ElationLinkPatientHandler, ProcessLinkPatientRequest } from "./elation-link-patient";

const region = Config.getAWSRegion();
const sqsClient = new SQSClient({ region });

export class ElationLinkPatientCloud implements ElationLinkPatientHandler {
  constructor(private readonly elationLinkPatientQueueUrl: string) {}

  async processLinkPatient(params: ProcessLinkPatientRequest): Promise<void> {
    const { cxId, practiceId, patientId } = params;
    const { log } = out(
      `processLinkPatient.cloud - cxId ${cxId} practiceId ${practiceId} patientId ${patientId}`
    );
    try {
      const payload = JSON.stringify(params);
      await sqsClient.sendMessageToQueue(this.elationLinkPatientQueueUrl, payload, {
        fifo: true,
        messageDeduplicationId: createUuidFromText(payload),
        messageGroupId: cxId,
      });
    } catch (error) {
      const msg = `Failure while processing patient link @ Elation`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          cxId,
          practiceId,
          patientId,
          context: "elation-link-patient-cloud.processLinkPatient",
          error,
        },
      });
      throw error;
    }
  }
}
