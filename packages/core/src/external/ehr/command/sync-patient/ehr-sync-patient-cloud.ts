import { createUuidFromText } from "@metriport/shared/common/uuid";
import { SQSClient } from "../../../../external/aws/sqs";
import { Config } from "../../../../util/config";
import { EhrSyncPatientHandler, ProcessSyncPatientRequest } from "./ehr-sync-patient";

export class EhrSyncPatientCloud implements EhrSyncPatientHandler {
  constructor(
    private readonly ehrSyncPatientQueueUrl: string = Config.getEhrSyncPatientQueueUrl(),
    private readonly sqsClient: SQSClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {}

  async processSyncPatient(params: ProcessSyncPatientRequest): Promise<void> {
    const { cxId } = params;
    const payload = JSON.stringify(params);
    await this.sqsClient.sendMessageToQueue(this.ehrSyncPatientQueueUrl, payload, {
      fifo: true,
      messageDeduplicationId: createUuidFromText(payload),
      messageGroupId: cxId,
    });
  }
}
