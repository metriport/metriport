import { executeWithNetworkRetries } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { SQSClient } from "../../../../../external/aws/sqs";
import { Config } from "../../../../../util/config";
import { FhirToCsvHandler, ProcessFhirToCsvRequest } from "./fhir-to-csv";

export class FhirToCsvCloud implements FhirToCsvHandler {
  constructor(
    private readonly fhirToCsvQueueUrl: string = Config.getFhirToCsvQueueUrl(),
    private readonly sqsClient: SQSClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {}

  async processFhirToCsv(params: ProcessFhirToCsvRequest): Promise<void> {
    const { patientId } = params;
    const payload = JSON.stringify(params);
    await executeWithNetworkRetries(async () => {
      await this.sqsClient.sendMessageToQueue(this.fhirToCsvQueueUrl, payload, {
        fifo: true,
        messageDeduplicationId: createUuidFromText(payload),
        messageGroupId: patientId,
      });
    });
  }
}
