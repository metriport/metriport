import { executeWithNetworkRetries } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { SQSClient } from "../../../../../external/aws/sqs";
import { Config } from "../../../../../util/config";
import { HealthieLinkPatientHandler, ProcessLinkPatientRequest } from "./healthie-link-patient";

export class HealthieLinkPatientCloud implements HealthieLinkPatientHandler {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly healthieLinkPatientQueueUrl: string,
    sqsClient: SQSClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {
    this.sqsClient = sqsClient;
  }

  async processLinkPatient(params: ProcessLinkPatientRequest): Promise<void> {
    const { cxId } = params;
    const payload = JSON.stringify(params);
    await executeWithNetworkRetries(async () => {
      await this.sqsClient.sendMessageToQueue(this.healthieLinkPatientQueueUrl, payload, {
        fifo: true,
        messageDeduplicationId: createUuidFromText(payload),
        messageGroupId: cxId,
      });
    });
  }
}
