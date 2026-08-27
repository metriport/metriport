import { out } from "@metriport/core/util/log";
import { MetriportError } from "@metriport/shared";
import { NetworkQueryCmd } from "@metriport/shared/domain/network-query/query";
import {
  DatasourceQueryStatus,
  NetworkQueryStatus,
  SourceQueryError,
  SourceQueryProgress,
  datasourceEntryToError,
  datasourceEntryToProgress,
} from "@metriport/shared/domain/network-query/source";
import { createNetworkQuery } from "./create-network-query";
import { getNetworkQueryByRequestId, NetworkQuery } from "./get-network-query";
import { queryDocumentsFromSource } from "./source-query";

export type NetworkQueryResult = {
  requestId: string;
  status: NetworkQueryStatus;
  sources: SourceQueryProgress[];
  errors?: SourceQueryError[];
};

/**
 * Starts a network query for documents across configured medical data networks (HIEs, pharmacies, and laboratories).
 *
 * @param networkQuery - The network query command.
 * @returns The requestId, overall status, per-source progress, and any errors.
 */
export async function startNetworkQuery(
  networkQuery: NetworkQueryCmd
): Promise<NetworkQueryResult> {
  const { requestId, cxId, patientId, facilityId, sources: sourcesParam, metadata } = networkQuery;
  const sources = [...new Set(sourcesParam)];

  await createNetworkQuery({
    requestId,
    cxId,
    patientId,
    sources,
    metadata,
  });

  const { log } = out(
    `startNetworkQuery - cxId ${cxId} facilityId ${facilityId} patientId ${patientId} requestId ${requestId}`
  );
  log(`Starting network query for sources: ${sources.join(", ")}`);

  await Promise.allSettled(
    sources.map(source =>
      queryDocumentsFromSource({
        ...networkQuery,
        requestId,
        source,
      })
    )
  );

  const networkQueryResult = await getNetworkQueryByRequestId({ requestId });
  if (!networkQueryResult) {
    throw new MetriportError("Network query not found after creation", undefined, { requestId });
  }

  return toNetworkQueryResult(networkQueryResult);
}

/**
 * Converts a NetworkQuery from the database to the API result format.
 */
function toNetworkQueryResult(networkQuery: NetworkQuery): NetworkQueryResult {
  const sources = networkQuery.datasources.map(entry =>
    datasourceEntryToProgress(entry, networkQuery.requestId)
  );

  const errors = networkQuery.datasources
    .filter(entry => entry.status === DatasourceQueryStatus.Failed)
    .map(datasourceEntryToError)
    .filter((e): e is SourceQueryError => e !== undefined);

  return {
    requestId: networkQuery.requestId,
    status: networkQuery.status,
    sources,
    ...(errors.length > 0 ? { errors } : {}),
  };
}

/**
 * Gets the status of a network query by its requestId.
 * Validates that the query belongs to the specified cxId.
 *
 * @param cxId - The CX ID (for authorization)
 * @param requestId - The unique request ID of the network query
 * @returns The requestId, overall status, and per-source progress, or undefined if not found
 */
export async function getNetworkQueryStatusByRequestId({
  cxId,
  requestId,
}: {
  cxId: string;
  requestId: string;
}): Promise<NetworkQueryResult | undefined> {
  const networkQuery = await getNetworkQueryByRequestId({ requestId });
  if (!networkQuery) return undefined;

  // Verify the query belongs to this customer
  if (networkQuery.cxId !== cxId) return undefined;

  return toNetworkQueryResult(networkQuery);
}
