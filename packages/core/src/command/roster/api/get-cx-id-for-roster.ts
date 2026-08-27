import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { MEDICAL_ROSTER_ROUTE } from "./api-shared";

/**
 * Gets the customer ID for the given roster ID.
 *
 * @param rosterId - The ID of the roster to get the customer ID for.
 * @returns The customer ID.
 */
export async function getCxIdForRoster(rosterId: string): Promise<string> {
  const { log } = out(`getCxIdForRoster - rosterId ${rosterId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const getCxIdFromRosterIdUrl = `${MEDICAL_ROSTER_ROUTE}/${rosterId}/cx-id`;
  try {
    const response = await executeWithNetworkRetries(() =>
      api.get<{ cxId: string }>(getCxIdFromRosterIdUrl)
    );
    return response.data.cxId;
  } catch (error) {
    const msg = "Failure while getting customer ID from roster @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      rosterId,
      url: getCxIdFromRosterIdUrl,
      context: "roster.getCxIdForRoster",
    });
  }
}
