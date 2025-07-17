import { executeWithNetworkRetries } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { Config } from "../../../../util/config";
import { SQSClient } from "../../../aws/sqs";
import { QuestSendPatientRequestHandler } from "./send-patient-request";
import { QuestPatientRequest, QuestJob } from "../../types";

export class QuestSendPatientRequestCloud implements QuestSendPatientRequestHandler {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly questSendPatientRequestQueueUrl: string,
    region?: string,
    sqsClient?: SQSClient
  ) {
    this.sqsClient = sqsClient ?? new SQSClient({ region: region ?? Config.getAWSRegion() });
  }

  async sendPatientRequest(requestData: QuestPatientRequest): Promise<QuestJob> {
    const payload = JSON.stringify(requestData);
    await executeWithNetworkRetries(async () => {
      await this.sqsClient.sendMessageToQueue(this.questSendPatientRequestQueueUrl, payload, {
        fifo: true,
        messageDeduplicationId: createUuidFromText(payload),
        messageGroupId: requestData.cxId,
      });
    });

    // TODO: ENG-565 - Quest scheduler will be implemented in a future PR
    return {} as QuestJob;
  }
}
