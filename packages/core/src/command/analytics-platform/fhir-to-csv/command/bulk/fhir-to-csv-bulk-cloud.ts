import { SQSBatchMessage, SQSClient, SQSParametersFifo } from "../../../../../external/aws/sqs";
import { Config } from "../../../../../util/config";
import { out } from "../../../../../util/log";
import { FhirToCsvBulkHandler, ProcessFhirToCsvBulkRequest } from "./fhir-to-csv-bulk";

export class FhirToCsvBulkCloud implements FhirToCsvBulkHandler {
  constructor(
    private readonly fhirToCsvQueueUrl: string = Config.getFhirToCsvBulkQueueUrl(),
    private readonly sqsClient: SQSClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {}

  /**
   * Triggers the conversion of consolidated/FHIR to CSV in bulk.
   *
   * The conversion happens asynchronously by sending messages to SQS and letting the FhirToCsvBulkDirect
   * lambda handle the conversion.
   *
   * @param params - The request object.
   * @returns The IDs of the patients that failed to send to the queue (not the actual conversion).
   */
  async processFhirToCsvBulk(params: ProcessFhirToCsvBulkRequest): Promise<string[]> {
    const { patientIds, cxId, outputPrefix, timeoutInMillis } = params;
    const { log } = out(`FhirToCsvBulkCloud.processFhirToCsvBulk - cx ${cxId}`);

    const uniquePatientIds = [...new Set(patientIds)];
    const messages: SQSBatchMessage<SQSParametersFifo>[] = uniquePatientIds.map(patientId => {
      const payload = JSON.stringify({
        cxId,
        patientId,
        outputPrefix,
        timeoutInMillis,
      });
      const message: SQSBatchMessage<SQSParametersFifo> = {
        id: patientId,
        body: payload,
        fifo: true,
        messageGroupId: patientId,
        messageDeduplicationId: patientId,
      };
      return message;
    });
    log(`Sending ${uniquePatientIds.length} patients to queue...`);

    const failedMessages = await this.sqsClient.sendMessagesToQueueInBatches(
      this.fhirToCsvQueueUrl,
      messages,
      params.progressCallback
    );
    const failedPatientIds = failedMessages.map(m => m.id);
    return failedPatientIds;
  }
}
