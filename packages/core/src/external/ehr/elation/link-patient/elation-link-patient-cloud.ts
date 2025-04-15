import { createUuidFromText } from "@metriport/shared/common/uuid";
import { Config } from "../../../../util/config";
import { SQSClient } from "../../../aws/sqs";
import { ElationLinkPatientHandler, ProcessLinkPatientRequest } from "./elation-link-patient";

export class ElationLinkPatientCloud implements ElationLinkPatientHandler {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly elationLinkPatientQueueUrl: string,
    region?: string,
    sqsClient?: SQSClient
  ) {
    if (!sqsClient) {
      this.sqsClient = new SQSClient({ region: region ?? Config.getAWSRegion() });
    } else {
      this.sqsClient = sqsClient;
    }
  }

  async processLinkPatient(params: ProcessLinkPatientRequest): Promise<void> {
    const { cxId } = params;
    const payload = JSON.stringify(params);
    await this.sqsClient.sendMessageToQueue(this.elationLinkPatientQueueUrl, payload, {
      fifo: true,
      messageDeduplicationId: createUuidFromText(payload),
      messageGroupId: cxId,
    });
  }
}
