import {
  errorToString,
  executeWithNetworkRetries,
  MetriportError,
  RosterStatus,
} from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { MEDICAL_ROSTER_ROUTE, RosterParams, RosterResponse } from "./api-shared";

/**
 * Gets the latest roster for the given source and roster type.
 *
 * @param cxId - The customer ID.
 * @param source - The source of the roster.
 * @param type - The type of roster to find.
 * @param status - The status of the roster to find. Defaults to "open".
 * @returns The latest roster ID, or undefined if no roster was found.
 */
export async function getLatestRoster({
  cxId,
  source,
  type,
  status = "open",
}: Omit<RosterParams, "rosterId"> & {
  source: string;
  type: string;
  status?: RosterStatus;
}): Promise<string | undefined> {
  const { log } = out(
    `getLatestRoster - cxId ${cxId}, source ${source}, type ${type}, status ${status}`
  );
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const getLatestRosterUrl = `${MEDICAL_ROSTER_ROUTE}/latest`;
  const latestRosterParams = { source, type, status };
  let latestRoster: RosterResponse | undefined;
  try {
    const response = await executeWithNetworkRetries(() =>
      api.get<RosterResponse | undefined>(getLatestRosterUrl, {
        params: { cxId, ...latestRosterParams },
      })
    );
    latestRoster = response.data;
    if (latestRoster?.id) return latestRoster.id;
    return undefined;
  } catch (error) {
    const msg = "Failure while getting latest roster @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      source,
      type,
      status,
      url: getLatestRosterUrl,
      context: "roster.getLatestRoster",
    });
  }
}
