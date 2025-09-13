import { createUuidFromText } from "@metriport/shared/common/uuid";
import { SQSClient } from "../../../external/aws/sqs";
import { Config } from "../../../util/config";
import { DischargeRequery, ProcessDischargeRequeryRequest } from "./discharge-requery";

export class DischargeRequeryCloud implements DischargeRequery {
  constructor(
    private readonly dischargeRequeryQueueUrl: string = Config.getDischargeRequeryQueueUrl(),
    private readonly sqsClient: SQSClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {}

  async processDischargeRequery(params: ProcessDischargeRequeryRequest): Promise<void> {
    const payload = JSON.stringify(params);
    await this.sqsClient.sendMessageToQueue(this.dischargeRequeryQueueUrl, payload, {
      fifo: true,
      messageDeduplicationId: createUuidFromText(payload),
      messageGroupId: params.cxId,
    });
  }
}
