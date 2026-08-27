import { SQSClient } from "../../../../../external/aws/sqs";
import { Config } from "../../../../../util/config";
import { out } from "../../../../../util/log";
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
    const { cxId, patientId } = params;
    const { log } = out(`processFhirToCsvIncremental - cx ${cxId}, pt ${patientId}`);

    const jobId = params.jobId ?? this.generateJobId();
    const payload: ProcessFhirToCsvIncrementalRequest = {
      ...params,
      jobId,
    };
    const payloadString = JSON.stringify(payload);

    log(`Requesting ingestion of patient consolidated into FWH`);

    await this.sqsClient.sendMessageToQueue(this.fhirToCsvQueueUrl, payloadString, {
      fifo: true,
      messageDeduplicationId: patientId,
      messageGroupId: patientId,
    });

    return jobId;
  }
}
