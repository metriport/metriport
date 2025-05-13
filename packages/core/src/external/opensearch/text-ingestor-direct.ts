import { emptyFunction } from "@metriport/shared";
import { Client } from "@opensearch-project/opensearch";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { chunk } from "lodash";
import { out } from "../../util/log";
import { capture } from "../../util/notifications";
import {
  BulkOperation,
  BulkResponseErrorItem,
  processErrorsFromBulkResponse,
  OnBulkItemError,
} from "./bulk";
import { OpenSearchConfigDirectAccess } from "./index";
import { IndexFields } from "./index-based-on-resource";
import { createLexicalDeleteQuery } from "./lexical/lexical-search";

dayjs.extend(duration);

const DEFAULT_INGESTION_TIMEOUT = dayjs.duration(20, "seconds").asMilliseconds();
const DEFAULT_BULK_INGESTION_TIMEOUT = dayjs.duration(2, "minute").asMilliseconds();
const MAX_BULK_RETRIES = 3;

/**
 * Didn't find a good reference for OpenSearch, so using Elasticsearch's reference:
 * https://www.elastic.co/guide/en/elasticsearch/guide/current/bulk.html#_how_big_is_too_big
 * "A good bulk size to start playing with is around 5-15MB in size."
 * During tests got resource w/ 10KB.
 * 10MB / 10KB = 1_000
 */
// TODO Don't pre-chunk, but build the chunks on the fly based on the max the server can handle
// on each bulk request (~5MB)
const bulkChunkSize = 500;

export type IngestRequest = IndexFields;
export type IngestRequestResource = Omit<IndexFields, "cxId" | "patientId">;
export type DeleteRequest = Pick<IndexFields, "cxId" | "patientId">;

export type IngestBulkRequest = {
  cxId: string;
  patientId: string;
  resources: IngestRequestResource[];
  onItemError?: OnBulkItemError | undefined;
};

export type OpenSearchFileIngestorDirectSettings = {
  logLevel?: "info" | "debug" | "none";
};

export type OpenSearchTextIngestorDirectConfig = OpenSearchConfigDirectAccess & {
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

  /**
   * Ingests resources into OpenSearch in bulk.
   *
   * @param cxId - The cxId of the resources to ingest.
   * @param patientId - The patientId of the resources to ingest.
   * @param resources - The resources to ingest.
   * @param onItemError - The function to call for each item error, optional. See buildOnItemError()
   *                      for the default implementation.
   */
  async ingestBulk({ cxId, patientId, resources, onItemError }: IngestBulkRequest): Promise<void> {
    const defaultLogger = out(`ingestBulk - ${cxId} - ${patientId}`);
    const { log } = this.getLog(defaultLogger);

    const { indexName } = this.config;
    const auth = { username: this.username, password: this.password };
    const client = new Client({ node: this.endpoint, auth });

    log(`Ingesting ${resources.length} resources into index ${indexName}...`);
    const startedAt = Date.now();

    let errorCount = 0;
    const errors: Map<string, number> = new Map();
    const _onItemError = onItemError ?? buildOnItemError(errors);

    const chunks = chunk(resources, bulkChunkSize);
    for (const resourceChunk of chunks) {
      const errorCountChunk = await this.ingestBulkInternal({
        cxId,
        patientId,
        resources: resourceChunk,
        indexName,
        client,
        onItemError: _onItemError,
      });
      errorCount += errorCountChunk;
    }

    const time = Date.now() - startedAt;
    log(`Ingested ${resources.length} resources in ${time} ms, ${errorCount} errors`);
    if (errors.size > 0) captureErrors({ cxId, patientId, errors, log });
  }

  private async ingestBulkInternal({
    cxId,
    patientId,
    resources,
    indexName,
    client,
    onItemError,
  }: IngestBulkRequest & {
    indexName: string;
    client: Client;
  }): Promise<number> {
    const defaultLogger = out(`...ingestBulkInternal - ${cxId} - ${patientId}`);
    const { debug } = this.getLog(defaultLogger);

    const operation = "index";

    debug(`Ingesting ${resources.length} resources into index ${indexName}...`);

    const bulkRequest = resources.flatMap(resource =>
      resourceToBulkRequest({
        cxId,
        patientId,
        resource,
        operation,
      })
    );

    const startedAt = Date.now();
    const response = await client.bulk(
      { index: indexName, body: bulkRequest },
      { requestTimeout: DEFAULT_BULK_INGESTION_TIMEOUT, maxRetries: MAX_BULK_RETRIES }
    );
    const time = Date.now() - startedAt;

    const errorCount = processErrorsFromBulkResponse(response, operation, onItemError);
    debug(`${operation}ed ${resources.length} resources in ${time} ms, ${errorCount} errors`);

    return errorCount;
  }

  async delete({ cxId, patientId }: DeleteRequest): Promise<void> {
    const defaultLogger = out(`ingest - ${cxId} - ${patientId}`);
    const { log, debug } = this.getLog(defaultLogger);

    const { indexName } = this.config;
    const auth = { username: this.username, password: this.password };
    const client = new Client({ node: this.endpoint, auth });

    log(`Deleting resources from index ${indexName}...`);
    const startedAt = Date.now();

    const response = await client.deleteByQuery({
      index: indexName,
      body: createLexicalDeleteQuery({ cxId, patientId }),
    });
    const time = Date.now() - startedAt;
    log(`Successfully deleted in ${time} milliseconds`);
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

function resourceToBulkRequest({
  cxId,
  patientId,
  resource,
  operation,
}: {
  cxId: string;
  patientId: string;
  resource: IngestRequestResource;
  operation: BulkOperation;
}) {
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
}

/**
 * Builds the ID for an OpenSearch entry.
 *
 * @param cxId - The cxId of the resource.
 * @param patientId - The patientId of the resource.
 * @param resourceId - The resourceId of the resource.
 * @returns The ID for the OpenSearch entry.
 */
function getEntryId(cxId: string, patientId: string, resourceId: string): string {
  return `${cxId}_${patientId}_${resourceId}`;
}

/**
 * Builds a function that will add the error to the list if it doesn't already exist.
 *
 * NOTE: Assumes all requeests are for the same index and operation!
 *
 * @param errors - The list of errors to add to.
 * @returns A function that will add the error to the list if it doesn't already exist.
 */
function buildOnItemError(errors: Map<string, number>): OnBulkItemError {
  return (error: BulkResponseErrorItem) => {
    const count = errors.get(error.type) ?? 0;
    errors.set(error.type, count + 1);
  };
}

function captureErrors({
  cxId,
  patientId,
  errors,
  log,
}: {
  cxId: string;
  patientId: string;
  errors: Map<string, number>;
  log: typeof console.log;
}) {
  const errorMapToObj = Object.fromEntries(errors.entries());
  log(`Errors: `, () => JSON.stringify(errorMapToObj));
  capture.error("Errors ingesting resources into OpenSearch", {
    extra: { cxId, patientId, countPerErrorType: JSON.stringify(errorMapToObj, null, 2) },
  });
}
