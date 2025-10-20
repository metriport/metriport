import { executeWithNetworkRetries } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { SQSClient } from "../../../../../external/aws/sqs";
import { Config } from "../../../../../util/config";
import { ElationLinkPatientHandler, ProcessLinkPatientRequest } from "./elation-link-patient";

export class ElationLinkPatientCloud implements ElationLinkPatientHandler {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly elationLinkPatientQueueUrl: string,
    sqsClient: SQSClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {
    this.sqsClient = sqsClient;
  }

  async processLinkPatient(params: ProcessLinkPatientRequest): Promise<void> {
    const { cxId } = params;
    const payload = JSON.stringify(params);
    await executeWithNetworkRetries(async () => {
      await this.sqsClient.sendMessageToQueue(this.elationLinkPatientQueueUrl, payload, {
        fifo: true,
        messageDeduplicationId: createUuidFromText(payload),
        messageGroupId: cxId,
      });
    });
  }
}
