import {
  deriveNetworkQueryStatus,
  NetworkQueryStatus,
  DatasourceQueryEntry,
} from "@metriport/shared/domain/network-query/source";
import { NetworkQueryRequestViewModel } from "../../../models/medical/network-query-request-view";

/**
 * Network query entity (aggregated from datasource_query rows).
 *
 * Represents all sources for a single requestId.
 *
 * NOTE: This entity is retrieved from the `network_query_request` view,
 * which aggregates datasource_query rows by requestId.
 */
export type NetworkQuery = {
  cxId: string;
  patientId: string;
  requestId: string;
  /** Per-datasource query data (aggregated from individual datasource query rows) */
  datasources: DatasourceQueryEntry[];
  /** Derived from datasource statuses */
  status: NetworkQueryStatus;
  createdAt: Date;
  completedAt?: Date;
};

/**
 * Computes the derived status from datasource query data.
 */
export function computeNetworkQueryStatus(datasources: DatasourceQueryEntry[]): NetworkQueryStatus {
  const statuses = datasources.map(s => s.status);
  return deriveNetworkQueryStatus(statuses);
}

/**
 * Converts a view model row to a NetworkQuery entity.
 * The view provides pre-aggregated data; we only derive the status in TypeScript.
 */
function viewToNetworkQuery(row: NetworkQueryRequestViewModel): NetworkQuery {
  const datasources = row.getDatasources();
  const status = computeNetworkQueryStatus(datasources);
  return {
    cxId: row.cxId,
    patientId: row.patientId,
    requestId: row.requestId,
    datasources,
    status,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
}

export type GetNetworkQueryByRequestIdCmd = {
  requestId: string;
};

/**
 * Gets a network query by its requestId.
 * Queries the network_query_request view which aggregates datasource_query rows.
 *
 * @param requestId - The unique request ID of the network query
 * @returns The network query or undefined if not found
 */
export async function getNetworkQueryByRequestId({
  requestId,
}: GetNetworkQueryByRequestIdCmd): Promise<NetworkQuery | undefined> {
  const row = await NetworkQueryRequestViewModel.findOne({ where: { requestId } });
  if (!row) return undefined;
  return viewToNetworkQuery(row);
}
