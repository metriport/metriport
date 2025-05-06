import { emptyFunction } from "@metriport/shared";
import { Client } from "@opensearch-project/opensearch";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { out } from "../../util/log";
import { contentFieldName, OpenSearchIngestorConfig } from "./index";

dayjs.extend(duration);

const DEFAULT_INGESTION_TIMEOUT = dayjs.duration(20, "seconds").asMilliseconds();

export type IngestRequest = {
  cxId: string;
  patientId: string;
  resourceType: string;
  resourceId: string;
  [contentFieldName]: string;
};

export type OpenSearchFileIngestorDirectSettings = {
  logLevel?: "info" | "debug" | "none";
};

export type OpenSearchTextIngestorDirectConfig = OpenSearchIngestorConfig & {
  endpoint: string;
  username: string;
  password: string;
  settings?: OpenSearchFileIngestorDirectSettings;
};

// TODO eng-41 Make this a factory so we can delegate the processing to a lambda
export class OpenSearchTextIngestorDirect {
  private readonly endpoint: string;
  private readonly username: string;
  private readonly password: string;
  private readonly settings: OpenSearchFileIngestorDirectSettings;

  constructor(readonly config: OpenSearchTextIngestorDirectConfig) {
    // super(config);
    this.endpoint = config.endpoint;
    this.username = config.username;
    this.password = config.password;
    this.settings = {
      logLevel: config.settings?.logLevel ?? "none",
    };
  }

  async ingest({
    cxId,
    patientId,
    resourceType,
    resourceId,
    content,
  }: IngestRequest): Promise<void> {
    const defaultLogger = out(`ingest - ${cxId} - ${patientId}`);
    const { log, debug } = this.getLog(defaultLogger);

    const { indexName } = this.config;
    const auth = { username: this.username, password: this.password };
    const client = new Client({ node: this.endpoint, auth });

    // Rebuild to make sure we're only sending the minimum amount of data
    const document: IngestRequest = {
      cxId,
      patientId,
      resourceType,
      resourceId,
      content,
    };
    // TODO eng-41 Useful so we can hit it directly, like a cache?
    const entryId = `${cxId}_${patientId}_${resourceId}`;

    log(`Ingesting resource ${resourceType} ${resourceId} into index ${indexName}...`);
    const startedAt = Date.now();
    // upsert
    const response = await client.update(
      {
        index: indexName,
        id: entryId,
        body: { doc: document, doc_as_upsert: true },
      },
      { requestTimeout: DEFAULT_INGESTION_TIMEOUT }
    );
    const time = Date.now() - startedAt;
    log(`Successfully ingested in ${time} milliseconds: ${resourceType} ${resourceId}`);
    debug(`Response: `, () => JSON.stringify(response.body));
  }

  private getLog(defaultLogger: ReturnType<typeof out>): ReturnType<typeof out> {
    if (this.settings.logLevel === "none") return { debug: emptyFunction, log: emptyFunction };
    return {
      debug: this.settings.logLevel === "debug" ? defaultLogger.debug : emptyFunction,
      log: defaultLogger.log,
    };
  }
}
