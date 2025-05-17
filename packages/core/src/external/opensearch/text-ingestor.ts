import { Client } from "@opensearch-project/opensearch";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { chunk } from "lodash";
import { out } from "../../util/log";
import { OpenSearchConfigDirectAccess } from "./index";
import { IndexFields } from "./index-based-on-resource";
import {
  BulkResponseErrorItem,
  processErrorsFromBulkResponse,
  OnBulkItemError,
  resourceToBulkRequest,
} from "./shared/bulk";
import { createDeleteQuery } from "./shared/delete";
import { getEntryId } from "./shared/id";
import { getLog, OpenSearchLogLevel } from "./shared/log";

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

export type IngestBulkRequest = {
  cxId: string;
  patientId: string;
  resources: IngestRequestResource[];
  onItemError?: OnBulkItemError | undefined;
};

export type DeleteRequest = Pick<IndexFields, "cxId" | "patientId">;

export type OpenSearchTextIngestorSettings = {
  logLevel?: OpenSearchLogLevel;
};

export type OpenSearchTextIngestorConfig = OpenSearchConfigDirectAccess & {
  settings?: OpenSearchTextIngestorSettings;
};

/**
 * Ingests text documents/entries in OpenSearch.
 */
export class OpenSearchTextIngestor {
  private readonly endpoint: string;
  private readonly username: string;
  private readonly password: string;
  private readonly settings: OpenSearchTextIngestorSettings;

  constructor(readonly config: OpenSearchTextIngestorConfig) {
    this.endpoint = config.endpoint;
    this.username = config.username;
    this.password = config.password;
    this.settings = {
      logLevel: config.settings?.logLevel ?? "none",
    };
  }

  async ingestSingle({
    cxId,
    patientId,
    resourceType,
    resourceId,
    content,
  }: IngestRequest): Promise<void> {
    const defaultLogger = out(`${this.constructor.name}.ingest - cx ${cxId}, pt ${patientId}`);
    const { log, debug } = getLog(defaultLogger, this.settings.logLevel);

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
   * @returns A map of error type as key and count of errors as value.
   */
  async ingestBulk({
    cxId,
    patientId,
    resources,
    onItemError,
  }: IngestBulkRequest): Promise<Map<string, number>> {
    const defaultLogger = out(`${this.constructor.name}.ingestBulk - cx ${cxId}, pt ${patientId}`);
    const { log } = getLog(defaultLogger, this.settings.logLevel);

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
    return errors;
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
    const defaultLogger = out(
      `${this.constructor.name}.ingestBulkInternal - cx ${cxId}, pt ${patientId}`
    );
    const { debug } = getLog(defaultLogger, this.settings.logLevel);

    const operation = "index";

    debug(`Ingesting ${resources.length} resources into index ${indexName}...`);

    const bulkRequest = resources.flatMap(resource =>
      resourceToBulkRequest({
        cxId,
        patientId,
        resource,
        operation,
        getEntryId,
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
    const defaultLogger = out(`${this.constructor.name}.delete - cx ${cxId}, pt ${patientId}`);
    const { log, debug } = getLog(defaultLogger, this.settings.logLevel);

    const { indexName } = this.config;
    const auth = { username: this.config.username, password: this.config.password };
    const client = new Client({ node: this.config.endpoint, auth });

    log(`Deleting resources from index ${indexName}...`);
    const startedAt = Date.now();

    const response = await client.deleteByQuery({
      index: indexName,
      body: createDeleteQuery({ cxId, patientId }),
    });
    const time = Date.now() - startedAt;
    log(`Successfully deleted in ${time} milliseconds`);
    debug(`Response: `, () => JSON.stringify(response.body));
  }
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
