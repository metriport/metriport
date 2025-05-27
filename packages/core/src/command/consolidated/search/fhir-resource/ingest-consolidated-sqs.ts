import { executeWithNetworkRetries } from "@metriport/shared";
import { SQSClient } from "../../../../external/aws/sqs";
import { executeAsynchronously } from "../../../../util/concurrency";
import { Config } from "../../../../util/config";
import {
  SQS_MESSAGE_BATCH_MILLIS_TO_SLEEP,
  SQS_MESSAGE_BATCH_SIZE_STANDARD,
} from "../../../../util/sqs";
import {
  IngestConsolidated,
  IngestConsolidatedParams,
  IngestConsolidatedResult,
  IngestMultipleConsolidatedParams,
} from "./ingest-consolidated";

/**
 * Ingests a patient's consolidated data into OpenSearch through a queue.
 *
 * The actual ingestion is performed by a direct implementation.
 *
 * @see {@link IngestConsolidatedDirect}
 */
export class IngestConsolidatedSqs implements IngestConsolidated {
  constructor(
    region = Config.getAWSRegion(),
    private readonly queueUrl = Config.getConsolidatedIngestionQueueUrl(),
    private readonly sqsClient = new SQSClient({ region })
  ) {}

  async ingestConsolidatedIntoSearchEngine({
    cxId,
    patientId,
  }: IngestConsolidatedParams): Promise<IngestConsolidatedResult>;

  async ingestConsolidatedIntoSearchEngine({
    cxId,
    patientIds,
  }: IngestMultipleConsolidatedParams): Promise<IngestConsolidatedResult>;

  async ingestConsolidatedIntoSearchEngine(
    params: IngestConsolidatedParams | IngestMultipleConsolidatedParams
  ): Promise<IngestConsolidatedResult> {
    if ("patientIds" in params) {
      await executeAsynchronously(
        params.patientIds,
        patientId =>
          executeWithNetworkRetries(() => this.ingestSingle({ cxId: params.cxId, patientId })),
        {
          numberOfParallelExecutions: SQS_MESSAGE_BATCH_SIZE_STANDARD,
          delay: SQS_MESSAGE_BATCH_MILLIS_TO_SLEEP,
          minJitterMillis: 100,
          maxJitterMillis: 100,
        }
      );
    } else {
      await this.ingestSingle(params);
    }
    return true;
  }

  private async ingestSingle({ cxId, patientId }: IngestConsolidatedParams): Promise<void> {
    const payload: IngestConsolidatedParams = { cxId, patientId };
    await this.sqsClient.sendMessageToQueue(this.queueUrl, JSON.stringify(payload));
  }
}
