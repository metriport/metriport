import { out } from "../../../util/log";
import { getApi, NETWORK_QUERY_ROUTE, UpdateNetworkQueryStatusParams } from "./api-shared";

/**
 * Updates the status of a single datasource query by calling the internal API endpoint.
 *
 * This function is used by lambdas and other services running outside the main API server
 * to update datasource query status. Code running on the API server should use the command
 * directly instead of using this function to make an API call.
 *
 * @param params - The parameters for updating the datasource query status.
 * @param params.cxId - The customer ID.
 * @param params.patientId - The patient ID.
 * @param params.source - The source type (hie, pharmacy, lab).
 * @param params.specificSource - The specific provider (e.g., "surescripts", "quest").
 * @param params.toStatus - The new status (requested, on-roster, converted, completed, failed).
 * @param params.requestId - Optional: If provided, updates only that specific datasource query (no fromStatuses needed).
 * @param params.fromStatuses - Optional: Which statuses to update from (patient mode only, defaults inferred).
 * @param params.rosterId - Optional: Filter by rosterId in data field.
 */
export async function updateNetworkQueryStatus(
  params: UpdateNetworkQueryStatusParams
): Promise<void> {
  const { log } = out("updateNetworkQueryStatus");
  const { cxId, patientId, source, specificSource, toStatus, requestId, fromStatuses, rosterId } =
    params;

  const fromStatusesLog = fromStatuses ? `, fromStatuses: [${fromStatuses.join(", ")}]` : "";
  log(
    `Updating datasource query status - cxId: ${cxId}, patientId: ${patientId}, ` +
      `source: ${source}, toStatus: ${toStatus}${requestId ? `, requestId: ${requestId}` : ""}` +
      `${rosterId ? `, rosterId: ${rosterId}` : ""}${fromStatusesLog}`
  );

  try {
    await getApi().post(`${NETWORK_QUERY_ROUTE}/status`, {
      cxId,
      source,
      toStatus,
      ...(requestId ? { requestId } : { cxId, patientId }),
      ...(specificSource ? { specificSource } : {}),
      ...(fromStatuses ? { fromStatuses } : {}),
      ...(rosterId ? { rosterId } : {}),
    });
  } catch (error) {
    log(
      `Failed to update datasource query status - cxId: ${cxId}, patientId: ${patientId}, ` +
        `source: ${source}, toStatus: ${toStatus}, error: ${error}`
    );
    throw error;
  }
}
