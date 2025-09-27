import { executeWithNetworkRetries } from "@metriport/shared";
import { SQSClient } from "../../../../../external/aws/sqs";
import { Config } from "../../../../../util/config";
import {
  FhirToCsvIncrementalHandler,
  ProcessFhirToCsvIncrementalRequest,
} from "./fhir-to-csv-incremental";

export class FhirToCsvIncrementalCloud extends FhirToCsvIncrementalHandler {
  constructor(
    private readonly fhirToCsvQueueUrl: string = Config.getFhirToCsvIncrementalQueueUrl(),
    private readonly sqsClient: SQSClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {
    super();
  }

  async processFhirToCsvIncremental(params: ProcessFhirToCsvIncrementalRequest): Promise<string> {
    const { patientId } = params;
    const jobId = params.jobId ?? this.generateJobId();
    const payload: ProcessFhirToCsvIncrementalRequest = {
      ...params,
      jobId,
    };
    const payloadStrig = JSON.stringify(payload);

    await executeWithNetworkRetries(async () => {
      await this.sqsClient.sendMessageToQueue(this.fhirToCsvQueueUrl, payloadStrig, {
        fifo: true,
        messageDeduplicationId: patientId,
        messageGroupId: patientId,
      });
    });

    return jobId;
  }
}
