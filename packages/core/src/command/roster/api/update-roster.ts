import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import { RosterStatus } from "@metriport/shared/domain/roster/roster-status";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { MEDICAL_ROSTER_ROUTE, RosterParams, RosterResponse } from "./api-shared";

/**
 * Updates a roster by ID.
 *
 * @param rosterId - The ID of the roster to update.
 * @param cxId - The customer ID.
 * @param status - The new status of the roster (optional).
 * @param data - The new data of the roster (optional).
 * @returns The ID of the updated roster.
 */
export async function updateRoster({
  status,
  data,
  rosterId,
  cxId,
}: RosterParams & { status?: RosterStatus; data?: unknown }): Promise<string> {
  const { log } = out(`updateRoster - rosterId ${rosterId}, cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const updateRosterUrl = `${MEDICAL_ROSTER_ROUTE}/${rosterId}`;
  try {
    const updateRosterResponse = await executeWithNetworkRetries(() =>
      api.patch<RosterResponse>(
        updateRosterUrl,
        {
          ...(status !== undefined ? { status } : {}),
          ...(data !== undefined ? { data } : {}),
        },
        { params: { cxId } }
      )
    );
    log(`Successfully updated roster ${rosterId}`);
    return updateRosterResponse.data.id;
  } catch (error) {
    const msg = "Failure while updating roster @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      rosterId,
      url: updateRosterUrl,
      context: "roster.updateRoster",
    });
  }
}
