import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { SQSClient } from "../aws/sqs";
import {
  FileSearchConnector,
  FileSearchConnectorConfig,
  IngestRequest,
} from "./file-search-connector";

dayjs.extend(utc);

export type FileSearchConnectorSQSConfig = FileSearchConnectorConfig & {
  queueUrl: string;
};

export class FileSearchConnectorSQS extends FileSearchConnector {
  private sqsClient: SQSClient;
  private queueUrl: string;

  constructor(config: FileSearchConnectorSQSConfig) {
    super(config);
    this.queueUrl = config.queueUrl;
    this.sqsClient = new SQSClient({ region: config.region });
  }

  async ingest({
    cxId,
    patientId,
    s3FileName,
    s3BucketName,
    requestId,
  }: IngestRequest): Promise<void> {
    const queueUrl = this.queueUrl;
    const payload = {
      cxId,
      patientId,
      s3FileName,
      s3BucketName,
      requestId,
      startedAt: dayjs.utc().toISOString(),
    };
    await this.sqsClient.sendMessageToQueue(queueUrl, JSON.stringify(payload));
  }
}
