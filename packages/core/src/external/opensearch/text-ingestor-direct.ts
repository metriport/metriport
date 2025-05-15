import { emptyFunction } from "@metriport/shared";
import { Client } from "@opensearch-project/opensearch";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { chunk } from "lodash";
import { out } from "../../util/log";
import { capture } from "../../util/notifications";
import { contentFieldName, OpenSearchIngestorConfig } from "./index";

dayjs.extend(duration);

const DEFAULT_INGESTION_TIMEOUT = dayjs.duration(20, "seconds").asMilliseconds();
const DEFAULT_BULK_INGESTION_TIMEOUT = dayjs.duration(1, "minute").asMilliseconds();

/**
 * Didn't find a good reference for OpenSearch, so using Elasticsearch's reference:
 * https://www.elastic.co/guide/en/elasticsearch/guide/current/bulk.html#_how_big_is_too_big
 * "A good bulk size to start playing with is around 5-15MB in size."
 * During tests, resources were 99.9% of the time under 250 Bytes.
 * 5MB / 250 Bytes = 20_000
 */
// const bulkChunkSize = 10_000;
const bulkChunkSize = 200;

export type IngestRequest = {
  cxId: string;
  patientId: string;
  resourceType: string;
  resourceId: string;
  [contentFieldName]: string;
};
export type IngestBulkRequest = {
  cxId: string;
  patientId: string;
  resources: Omit<IngestRequest, "cxId" | "patientId">[];
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
    const entryId = getEntryId(cxId, patientId, resourceId);

    log(`Ingesting resource ${resourceType} ${resourceId} into index ${indexName}...`);
    const startedAt = Date.now();
    // upsert
    const response = await client.index(
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

  async ingestBulk({ cxId, patientId, resources }: IngestBulkRequest): Promise<void> {
    const defaultLogger = out(`ingestBulk - ${cxId} - ${patientId}`);
    const { log } = this.getLog(defaultLogger);

    const { indexName } = this.config;
    const auth = { username: this.username, password: this.password };
    const client = new Client({ node: this.endpoint, auth });

    log(`Ingesting ${resources.length} resources into index ${indexName}...`);
    const startedAt = Date.now();

    const chunks = chunk(resources, bulkChunkSize);
    const errors: string[] = [];
    for (const chunk of chunks) {
      const { errors: chunkErrors } = await this.ingestBulkInternal({
        cxId,
        patientId,
        resources: chunk,
        indexName,
        client,
      });
      errors.push(...chunkErrors);
    }

    const time = Date.now() - startedAt;
    log(
      `Bulk ingested ${resources.length} resources in ${time} milliseconds, ${errors.length} errors`
    );
    if (errors.length > 0) {
      const errorsToCapture = errors.slice(0, 20);
      log(`Errors (${errors.length}): `, () => JSON.stringify(errorsToCapture));
      capture.error("Errors ingesting resources into OpenSearch", {
        extra: { cxId, patientId, errors: errorsToCapture },
      });
    }
  }

  private async ingestBulkInternal({
    cxId,
    patientId,
    resources,
    indexName,
    client,
  }: IngestBulkRequest & {
    indexName: string;
    client: Client;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }): Promise<{ errors: any[] }> {
    const defaultLogger = out(`...ingestBulkInternal - ${cxId} - ${patientId}`);
    const { debug } = this.getLog(defaultLogger);

    const operation = "index";

    debug(`Ingesting ${resources.length} resources into index ${indexName}...`);
    const startedAt = Date.now();

    const bulkBody = resources.flatMap(resource => {
      const entryId = getEntryId(cxId, patientId, resource.resourceId);
      const document: IngestRequest = {
        cxId,
        patientId,
        resourceType: resource.resourceType,
        resourceId: resource.resourceId,
        content: resource.content,
      };
      const cmd = { [operation]: { _id: entryId } };
      return [cmd, document];
    });

    const response = await client.bulk(
      { index: indexName, body: bulkBody },
      { requestTimeout: DEFAULT_BULK_INGESTION_TIMEOUT }
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errors = response.body.items.flatMap((item: any) =>
      item[operation].status > 299 ? item[operation].error.reason : []
    );

    const time = Date.now() - startedAt;
    debug(
      `Bulk ${operation}ed ${resources.length} resources in ${time} ms, ${errors.length} errors`
    );

    return { errors };
  }

  private getLog(defaultLogger: ReturnType<typeof out>): ReturnType<typeof out> {
    if (this.settings.logLevel === "none") return { debug: emptyFunction, log: emptyFunction };
    return {
      debug: this.settings.logLevel === "debug" ? defaultLogger.debug : emptyFunction,
      log: defaultLogger.log,
    };
  }
}

// TODO eng-41 Useful so we can hit it directly, like a cache?
function getEntryId(cxId: string, patientId: string, resourceId: string): string {
  return `${cxId}_${patientId}_${resourceId}`;
}
