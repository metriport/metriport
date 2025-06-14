import { executeWithNetworkRetries } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { Config } from "../../../../util/config";
import { SQSClient } from "../../../aws/sqs";
import { SurescriptsSendPatientRequestHandler } from "./send-patient-request";
import { SurescriptsPatientRequest } from "../../types";

export class SurescriptsSendPatientRequestCloud implements SurescriptsSendPatientRequestHandler {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly surescriptsSendPatientRequestQueueUrl: string,
    region?: string,
    sqsClient?: SQSClient
  ) {
    this.sqsClient = sqsClient ?? new SQSClient({ region: region ?? Config.getAWSRegion() });
  }

  async sendPatientRequest(requestData: SurescriptsPatientRequest): Promise<void> {
    const payload = JSON.stringify(requestData);
    await executeWithNetworkRetries(async () => {
      await this.sqsClient.sendMessageToQueue(this.surescriptsSendPatientRequestQueueUrl, payload, {
        fifo: true,
        messageDeduplicationId: createUuidFromText(payload),
        messageGroupId: requestData.cxId,
      });
    });
  }
}
