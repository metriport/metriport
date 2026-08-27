import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { MEDICAL_ROSTER_ROUTE, RosterParams, RosterResponse } from "./api-shared";

/**
 * Gets the roster for the given customer and roster ID.
 *
 * @param cxId - The customer ID.
 * @param rosterId - The roster ID.
 * @returns The roster.
 */
export async function getRoster({ cxId, rosterId }: RosterParams): Promise<RosterResponse> {
  const { log } = out(`getRoster - cxId ${cxId}, rosterId ${rosterId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const getRosterUrl = `${MEDICAL_ROSTER_ROUTE}/${rosterId}`;
  try {
    const response = await executeWithNetworkRetries(() =>
      api.get<RosterResponse>(getRosterUrl, { params: { cxId } })
    );
    return response.data;
  } catch (error) {
    const msg = "Failure while getting roster @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      rosterId,
      url: getRosterUrl,
      context: "roster.getRoster",
    });
  }
}
