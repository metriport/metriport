import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { Config } from "../../shared/config";
import { sendMessageToQueue } from "../aws/sqs";
import { FileSearchConnector, IngestRequest } from "./file-search-connector";

dayjs.extend(utc);

export class FileSearchConnectorCloud extends FileSearchConnector {
  async ingest({
    cxId,
    patientId,
    s3FileName,
    s3BucketName,
    requestId,
  }: IngestRequest): Promise<void> {
    const queueUrl = Config.getSearchIngestionQueueUrl();
    if (!queueUrl) {
      console.log(
        `SearchIngestionQueueUrl is not configured, skipping ingestion of file ${s3FileName}`
      );
      return;
    }
    const payload = {
      cxId,
      patientId,
      s3FileName,
      s3BucketName,
      requestId,
      startedAt: dayjs.utc().toISOString(),
    };
    await sendMessageToQueue(queueUrl, JSON.stringify(payload));
  }
}
