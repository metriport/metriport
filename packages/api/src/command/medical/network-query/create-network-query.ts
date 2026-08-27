import { out } from "@metriport/core/util/log";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import {
  DatasourceQueryStatus,
  getSpecificSource,
  NetworkSource,
} from "@metriport/shared/domain/network-query";
import { DatasourceQueryModel } from "../../../models/medical/datasource-query";

export type CreateNetworkQueryCmd = {
  requestId: string;
  cxId: string;
  patientId: string;
  sources: NetworkSource[];
  metadata?: Record<string, string>;
};

export type NetworkQueryCreateResult = {
  requestId: string;
};

/**
 * Creates a new network query by inserting rows into the datasource_query table.
 *
 * All sources start with status="initialized" to indicate the tracking row
 * has been created but no actual request/action has been taken yet.
 *
 * As various source query functions are called, they will update statuses to "on-roster", "requested", etc. when applicable
 *
 * The datasource_query table is aggregated by the `network_query_request` view,
 * which rolls up all datasource queries with the same requestId into a single
 * network query record.
 *
 * @param cxId - The CX ID
 * @param patientId - The patient ID
 * @param sources - The data sources to query
 * @returns The new requestId
 */
export async function createNetworkQuery({
  requestId,
  cxId,
  patientId,
  sources,
  metadata,
}: CreateNetworkQueryCmd): Promise<NetworkQueryCreateResult> {
  const { log } = out(`createNetworkQuery - cxId ${cxId}, patientId ${patientId}`);

  log(`Creating new network query ${requestId} for sources: ${sources.join(", ")}`);

  const now = new Date();
  const rowsToCreate = sources.map(source => ({
    id: uuidv7(),
    cxId,
    patientId,
    requestId,
    source,
    specificSource: getSpecificSource(source),
    status: DatasourceQueryStatus.Initialized,
    statusChangedAt: now,
    ...(metadata ? { data: { metadata } } : {}),
  }));

  await DatasourceQueryModel.bulkCreate(rowsToCreate);

  return { requestId };
}
