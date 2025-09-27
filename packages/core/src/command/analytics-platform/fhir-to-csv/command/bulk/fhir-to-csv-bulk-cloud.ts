import { executeWithNetworkRetries, uuidv4 } from "@metriport/shared";
import { SQSClient } from "../../../../../external/aws/sqs";
import { Config } from "../../../../../util/config";
import { FhirToCsvBulkHandler, ProcessFhirToCsvBulkRequest } from "./fhir-to-csv-bulk";

export class FhirToCsvBulkCloud implements FhirToCsvBulkHandler {
  constructor(
    private readonly fhirToCsvQueueUrl: string = Config.getFhirToCsvBulkQueueUrl(),
    private readonly sqsClient: SQSClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {}

  async processFhirToCsvBulk(params: ProcessFhirToCsvBulkRequest): Promise<void> {
    const { patientId } = params;
    const payload = JSON.stringify(params);
    const messageDeduplicationId = uuidv4();
    await executeWithNetworkRetries(async () => {
      await this.sqsClient.sendMessageToQueue(this.fhirToCsvQueueUrl, payload, {
        fifo: true,
        messageDeduplicationId,
        messageGroupId: patientId,
      });
    });
  }
}
