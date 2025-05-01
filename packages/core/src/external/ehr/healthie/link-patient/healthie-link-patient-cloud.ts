import { createUuidFromText } from "@metriport/shared/common/uuid";
import { Config } from "../../../../util/config";
import { SQSClient } from "../../../aws/sqs";
import { HealthieLinkPatientHandler, ProcessLinkPatientRequest } from "./healthie-link-patient";

export class HealthieLinkPatientCloud implements HealthieLinkPatientHandler {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly healthieLinkPatientQueueUrl: string,
    region?: string,
    sqsClient?: SQSClient
  ) {
    this.sqsClient = sqsClient ?? new SQSClient({ region: region ?? Config.getAWSRegion() });
  }

  async processLinkPatient(params: ProcessLinkPatientRequest): Promise<void> {
    const { cxId } = params;
    const payload = JSON.stringify(params);
    await this.sqsClient.sendMessageToQueue(this.healthieLinkPatientQueueUrl, payload, {
      fifo: true,
      messageDeduplicationId: createUuidFromText(payload),
      messageGroupId: cxId,
    });
  }
}
