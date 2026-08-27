import { out } from "../../../util/log";
import {
  BulkUpdateDatasourceQueryStatusParams,
  BulkUpdateResult,
  getApi,
  NETWORK_QUERY_ROUTE,
} from "./api-shared";

/**
 * Makes an API call to bulk update the status of datasource queries for multiple patients.
 *
 * @param params - The parameters for the bulk update.
 * @param params.patients - Array of { cxId, patientId } to update.
 * @param params.source - The source type (hie, pharmacy, lab).
 * @param params.specificSource - The specific provider (e.g., "surescripts", "quest").
 * @param params.fromStatuses - Which statuses to update from.
 * @param params.toStatus - The new status (requested, on-roster, converted, completed, failed).
 * @param params.rosterId - Optional: Filter by rosterId in data field.
 * @returns Object with updatedCount, patientsUpdated, and patientsNotFound.
 */
export async function bulkUpdateDatasourceQueryStatus(
  params: BulkUpdateDatasourceQueryStatusParams
): Promise<BulkUpdateResult> {
  const { log } = out("bulkUpdateDatasourceQueryStatus");
  const { patients, source, specificSource, fromStatuses, toStatus, rosterId } = params;

  if (patients.length < 1) {
    log("No patients to update");
    return { updatedCount: 0, patientsUpdated: [], patientsNotFound: [] };
  }

  log(
    `Bulk updating ${patients.length} patients, ` +
      `source: ${source}, toStatus: ${toStatus}` +
      (rosterId ? `, rosterId: ${rosterId}` : "")
  );

  const response = await getApi().post<BulkUpdateResult>(`${NETWORK_QUERY_ROUTE}/status/bulk`, {
    patients,
    source,
    specificSource,
    fromStatuses,
    toStatus,
    ...(rosterId ? { rosterId } : {}),
  });

  const result = response.data;
  log(
    `Bulk update complete: ${result.updatedCount} rows updated, ` +
      `${result.patientsUpdated.length} patients updated, ${result.patientsNotFound.length} not found`
  );

  return result;
}
