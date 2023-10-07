import * as AWS from "aws-sdk";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { out } from "../../util/log";
import { uuidv4 } from "../../util/uuid-v7";
import * as xml from "../../util/xml";
import { makeS3Client } from "../aws/s3";
import { SQSClient } from "../aws/sqs";
import {
  IngestRequest,
  OpenSearchFileIngestor,
  OpenSearchFileIngestorConfig,
} from "./file-ingestor";

dayjs.extend(utc);

export type OpenSearchFileIngestorSQSConfig = OpenSearchFileIngestorConfig & {
  queueUrl: string;
};

export type StoreAndIngestRequest = IngestRequest & { content: string | string[] };

export type FileIngestorSQSPayload = IngestRequest & { startedAt: string };

const entryName = "entry";
const entryListName = "entries";
const entryListOpen = xml.open(entryListName);
const entryListClose = xml.close(entryListName);
const entryOpen = xml.open(entryName);
const entryClose = xml.close(entryName);

export class OpenSearchFileIngestorSQS extends OpenSearchFileIngestor {
  private sqsClient: SQSClient;
  private s3Client: AWS.S3;
  private queueUrl: string;

  constructor(config: OpenSearchFileIngestorSQSConfig) {
    super(config);
    this.queueUrl = config.queueUrl;
    this.sqsClient = new SQSClient({ region: config.region });
    this.s3Client = makeS3Client(config.region);
  }

  async ingest({
    cxId,
    patientId,
    entryId,
    s3FileName,
    s3BucketName,
    requestId,
  }: IngestRequest): Promise<void> {
    const queueUrl = this.queueUrl;
    const payload: FileIngestorSQSPayload = {
      cxId,
      patientId,
      entryId,
      s3FileName,
      s3BucketName,
      requestId: requestId ?? uuidv4(),
      startedAt: dayjs.utc().toISOString(),
    };
    await this.sqsClient.sendMessageToQueue(queueUrl, JSON.stringify(payload));
  }

  async storeAndIngest({
    cxId,
    patientId,
    content,
    s3FileName: originalFileName,
    s3BucketName,
    entryId,
    requestId,
  }: StoreAndIngestRequest): Promise<void> {
    const { log } = out(`storeAndIngest - cx ${cxId}; patient ${patientId}; entry ${entryId}`);
    const contentToIngest =
      typeof content === "string" ? content : this.multipleContentToSingleString(content);
    const s3FileName = this.getIngestionFileName(originalFileName);
    log(`Uploading to ${s3BucketName}/${s3FileName}...`);
    await this.s3Client
      .upload({
        Bucket: s3BucketName,
        Key: s3FileName,
        Body: contentToIngest,
        ContentType: "text/plain",
      })
      .promise();
    log(`Done, sending message to SQS...`);
    await this.ingest({
      cxId,
      patientId,
      entryId,
      s3FileName,
      s3BucketName,
      requestId,
    });
  }

  protected getIngestionFileName(docId: string) {
    return `${docId}_searchingestion.txt`;
  }

  protected multipleContentToSingleString(entries: string[]) {
    const content = entries.join(`${entryClose}${entryOpen}`);
    const contentToIngest = `${entryListOpen}${entryOpen}${content}${entryClose}${entryListClose}`;
    return contentToIngest;
  }
}
