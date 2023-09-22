import { Client } from "@opensearch-project/opensearch";
import { Config } from "../../shared/config";
import { Util } from "../../shared/util";
import { makeS3Client } from "../aws/s3";
import { FileSearchConnector, IngestRequest } from "./file-search-connector";

const s3 = makeS3Client();
const endpoint = Config.getSearchEndpoint();
const password = Config.getSearchPassword() ?? "";

export class FileSearchConnectorLocal extends FileSearchConnector {
  async ingest({ cxId, patientId, s3FileName, s3BucketName }: IngestRequest): Promise<void> {
    const { debug: log } = Util.out(`ingest - ${cxId} - ${patientId}`, `- fileName: ${s3FileName}`);

    // do this before to avoid working on the file if not needed
    if (!endpoint) {
      log(`SearchEndpoint is not configured, skipping search ingestion...`);
      return;
    }

    // Download the contents from S3
    const data = await this.getFileContents(s3FileName, s3BucketName, log);
    if (!data) {
      log(`Empty data reading file from S3, skipping search ingestion...`);
      return;
    }

    const content = this.cleanUpContents(data, log);

    await this.sendToOpenSearch(
      {
        cxId,
        patientId,
        fileName: s3FileName,
        content,
      },
      log
    );
  }

  private async getFileContents(s3FileName: string, s3BucketName: string, log = console.log) {
    log(`Downloading from ${s3BucketName}...`);
    const obj = await s3
      .getObject({
        Bucket: s3BucketName,
        Key: s3FileName,
      })
      .promise();
    return obj.Body?.toString("utf-8");
  }

  // IMPORTANT: keep this in sync w/ the Lambda's sqs-to-opensearch-xml.ts version of it.
  // Ideally we would use the same code the Lambda does, but since the cost/benefit doesn't seeem to be worth it.
  private cleanUpContents(contents: string, log = console.log) {
    log(`Cleaning up file contents...`);
    const result = contents
      .trim()
      .toLowerCase()
      .replace(/"/g, "")
      .replace(/(\s\s+)|(\n\n)|(\n)|(\t)|(\r)/g, " ");
    return result;
  }

  private async sendToOpenSearch(
    {
      cxId,
      patientId,
      fileName,
      content,
    }: {
      cxId: string;
      patientId: string;
      fileName: string;
      content: string;
    },
    log = console.log
  ) {
    const username = "admin";

    const client = new Client({
      node: endpoint,
      auth: { username, password },
    });
    const body = {
      cxId,
      patientId,
      content,
    };

    log(`Sending payload to ${endpoint}...`);
    const response = await client.index({
      index: "ccda-files",
      id: fileName,
      body,
    });
    log(`Successfully ingested: ${JSON.stringify(response.body)}`);
  }
}
