import { executeWithNetworkRetries } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { SQSClient } from "../../../../external/aws/sqs";
import { Config } from "../../../../util/config";
import { EhrSyncPatientHandler, ProcessSyncPatientRequest } from "./ehr-sync-patient";

export class EhrSyncPatientCloud implements EhrSyncPatientHandler {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly ehrSyncPatientQueueUrl: string,
    sqsClient: SQSClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {
    this.sqsClient = sqsClient;
  }

  async processSyncPatient(params: ProcessSyncPatientRequest): Promise<void> {
    const { cxId } = params;
    const payload = JSON.stringify(params);
    await executeWithNetworkRetries(async () => {
      await this.sqsClient.sendMessageToQueue(this.ehrSyncPatientQueueUrl, payload, {
        fifo: true,
        messageDeduplicationId: createUuidFromText(payload),
        messageGroupId: cxId,
      });
    });
  }
}
