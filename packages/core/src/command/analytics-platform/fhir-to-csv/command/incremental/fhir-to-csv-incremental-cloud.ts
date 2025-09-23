import { executeWithNetworkRetries } from "@metriport/shared";
import { SQSClient } from "../../../../../external/aws/sqs";
import { Config } from "../../../../../util/config";
import {
  FhirToCsvIncrementalHandler,
  ProcessFhirToCsvIncrementalRequest,
} from "./fhir-to-csv-incremental";

export class FhirToCsvIncrementalCloud implements FhirToCsvIncrementalHandler {
  constructor(
    private readonly fhirToCsvQueueUrl: string = Config.getFhirToCsvIncrementalQueueUrl(),
    private readonly sqsClient: SQSClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {}

  async processFhirToCsvIncremental(params: ProcessFhirToCsvIncrementalRequest): Promise<void> {
    const { patientId } = params;
    const payload = JSON.stringify(params);
    await executeWithNetworkRetries(async () => {
      await this.sqsClient.sendMessageToQueue(this.fhirToCsvQueueUrl, payload, {
        fifo: true,
        messageDeduplicationId: patientId,
        messageGroupId: patientId,
      });
    });
  }
}
