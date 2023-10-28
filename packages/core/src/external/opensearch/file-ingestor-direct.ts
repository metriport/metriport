import { Client } from "@opensearch-project/opensearch";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { IndexFields } from ".";
import { out } from "../../util/log";
import { makeS3Client } from "../aws/s3";
import { genericStopWords, htmlStopWords } from "./cda";
import {
  IngestRequest,
  OpenSearchFileIngestor,
  OpenSearchFileIngestorConfig,
} from "./file-ingestor";

dayjs.extend(duration);

const DEFAULT_INGESTION_TIMEOUT = dayjs.duration(10, "minutes").asMilliseconds();

export const regexGenericWords = new RegExp(
  `(${genericStopWords.map(w => w.toLowerCase()).join("|")})`,
  "g"
);
// removes the tag w/ attributes, but without content
export const regexHTML = new RegExp(
  `</?(${htmlStopWords.map(w => w.toLowerCase()).join("|")})(\\s.*?)?/?>`,
  "g"
);
export const regexFormatting = new RegExp(/(__+|--+)/g);
export const regexMarkupAttributes = new RegExp(/((\w+(:\w+)?)(:\w+)?="(?<content>[^"]+?)")/g);
export const regexAdditionalMarkup = new RegExp(/<(\w+(:\w+)?)(\s*|\s(?<content>[^>]+?))\/?>/g);
export const regexClosingMarkup = new RegExp(/<\/(\w+(:\w+)?)>/g);
export const regexQuotesNewlinesTabs = new RegExp(/"|(\n\n)|\n|\t|\r|<!/g);
export const regexMultipleSpaces = new RegExp(/(\s\s+)/g);

export type OpenSearchFileIngestorDirectSettings = {
  logLevel?: "info" | "debug" | "none";
};

export type OpenSearchFileIngestorDirectConfig = OpenSearchFileIngestorConfig & {
  endpoint: string;
  username: string;
  password: string;
  settings?: OpenSearchFileIngestorDirectSettings;
};

export class OpenSearchFileIngestorDirect extends OpenSearchFileIngestor {
  private readonly endpoint: string;
  private readonly username: string;
  private readonly password: string;
  private readonly settings: OpenSearchFileIngestorDirectSettings;

  constructor(config: OpenSearchFileIngestorDirectConfig) {
    super(config);
    this.endpoint = config.endpoint;
    this.username = config.username;
    this.password = config.password;
    this.settings = {
      logLevel: config.settings?.logLevel ?? "none",
    };
  }

  // TODO split into 2: one that gets the actual content, another (class?) that gets form S3 and ingests w/ content
  async ingest({
    cxId,
    patientId,
    entryId,
    s3FileName,
    s3BucketName,
  }: IngestRequest): Promise<void> {
    const defaultLogger = out(`ingest - ${cxId} - ${patientId}`, `- fileName: ${s3FileName}`);
    const log = this.getLog(defaultLogger);

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
        entryId,
        s3FileName,
        content,
      },
      log
    );
  }

  protected async getFileContents(s3FileName: string, s3BucketName: string, log = console.log) {
    const s3 = makeS3Client(this.config.region);
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
  protected cleanUpContents(contents: string, log = console.log, isTracing = false): string {
    log(`Cleaning up file contents...`);

    const trace = (msg: string) => isTracing && log(msg);

    // Have this here so we can debug it easier when there's a problem. Use the unit test to add new
    // cases to represent future issues.
    let step = 1;
    const runStep = (fn: () => string, action: string): string => {
      const res = fn();
      trace(`Step${step}: ${action}`);
      trace(`Step${step}: ${res}`);
      step++;
      return res;
    };
    const regexStep = (updatedContents: string, regex: RegExp, replacement: string): string => {
      return runStep(() => updatedContents.replace(regex, replacement), regex.toString());
    };

    // The order is important!
    const step1 = runStep(() => contents.trim().toLowerCase(), "trim + lowercase");
    const regexSteps = [
      (input: string) => regexStep(input, regexHTML, " "),
      (input: string) => regexStep(input, regexFormatting, " "),
      (input: string) => regexStep(input, regexMarkupAttributes, " $<content> "),
      (input: string) => regexStep(input, regexAdditionalMarkup, " $<content> "),
      (input: string) => regexStep(input, regexClosingMarkup, " "),
      (input: string) => regexStep(input, regexGenericWords, " "),
      (input: string) => regexStep(input, regexQuotesNewlinesTabs, " "),
      (input: string) => regexStep(input, regexMultipleSpaces, " "),
    ];
    let lastStepResult = step1;
    for (const step of regexSteps) {
      lastStepResult = step(lastStepResult);
    }
    return lastStepResult;
  }

  protected async sendToOpenSearch(
    {
      cxId,
      patientId,
      entryId,
      s3FileName,
      content,
      requestTimeout,
    }: {
      cxId: string;
      patientId: string;
      entryId: string;
      s3FileName: string;
      content: string;
      requestTimeout?: number;
    },
    log = console.log
  ): Promise<void> {
    const { indexName } = this.config;
    const auth = { username: this.username, password: this.password };
    const client = new Client({ node: this.endpoint, auth });

    await this.makeSureIndexExists(client, indexName, log);

    // add a document to the index
    const document: IndexFields = {
      cxId,
      patientId,
      s3FileName,
      content,
    };

    log(`Ingesting file ${s3FileName} into index ${indexName}...`);
    // upsert
    const response = await client.update(
      {
        index: indexName,
        id: entryId,
        body: { doc: document, doc_as_upsert: true },
      },
      { requestTimeout: requestTimeout ?? DEFAULT_INGESTION_TIMEOUT }
    );
    log(`Successfully ingested it, response: ${JSON.stringify(response.body)}`);
  }

  private getLog(defaultLogger: ReturnType<typeof out>): typeof console.log {
    if (this.settings.logLevel === "none") return () => {}; //eslint-disable-line @typescript-eslint/no-empty-function
    if (this.settings.logLevel === "debug") return defaultLogger.debug;
    return defaultLogger.log;
  }

  private async makeSureIndexExists(client: Client, indexName: string, log = console.log) {
    const indexExists = Boolean((await client.indices.exists({ index: indexName })).body);
    if (!indexExists) {
      log(`Index ${indexName} doesn't exist, creating one...`);
      const indexProperties: Record<keyof IndexFields, { type: string }> = {
        cxId: { type: "keyword" },
        patientId: { type: "keyword" },
        s3FileName: { type: "keyword" },
        content: { type: "text" },
      };
      const body = { mappings: { properties: indexProperties } };
      const createResult = (await client.indices.create({ index: indexName, body })).body;
      log(`Created index ${indexName}: ${JSON.stringify(createResult)}`);
    }
  }
}
