import { executeWithNetworkRetries } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { Config } from "../../../../util/config";
import { SQSClient } from "../../../aws/sqs";
import {
  SurescriptsConvertPatientResponseHandler,
  SurescriptsPatientResponse,
} from "./convert-patient-response";

export class SurescriptsConvertPatientResponseHandlerCloud
  implements SurescriptsConvertPatientResponseHandler
{
  constructor(
    private readonly queueUrl: string = Config.getSurescriptsConvertPatientResponseQueueUrl(),
    private readonly sqsClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {}

  async convertPatientResponse(response: SurescriptsPatientResponse): Promise<void> {
    const payload = JSON.stringify(response);
    await executeWithNetworkRetries(async () => {
      await this.sqsClient.sendMessageToQueue(this.queueUrl, payload, {
        fifo: true,
        messageDeduplicationId: createUuidFromText(payload),
        messageGroupId: response.patientId,
      });
    });
  }
}
