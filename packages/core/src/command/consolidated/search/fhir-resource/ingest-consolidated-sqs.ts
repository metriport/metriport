import { SQSClient } from "../../../../external/aws/sqs";
import { Config } from "../../../../util/config";
import {
  IngestConsolidated,
  IngestConsolidatedParams,
  IngestConsolidatedResult,
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

  async ingestIntoSearchEngine({
    cxId,
    patientId,
  }: IngestConsolidatedParams): Promise<IngestConsolidatedResult> {
    const payload = JSON.stringify({ cxId, patientId });
    await this.sqsClient.sendMessageToQueue(this.queueUrl, payload);
    return true;
  }
}
