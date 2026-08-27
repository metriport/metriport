import {
  errorToString,
  executeWithNetworkRetries,
  MetriportError,
  RosterStatus,
} from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { MEDICAL_ROSTER_ROUTE, RosterParams, RostersResponse } from "./api-shared";

/**
 * Gets the rosters for the given source and roster type.
 *
 * @param cxId - The customer ID.
 * @param source - The source of the roster.
 * @param type - The type of roster to find.
 * @param status - The status of the roster to find. Defaults to "open".
 * @returns The rosters, or undefined if no rosters were found.
 */
export async function getRosters({
  cxId,
  source,
  type,
  status = "open",
}: Omit<RosterParams, "rosterId"> & {
  source: string;
  type: string;
  status?: RosterStatus;
}): Promise<RostersResponse["rosters"]> {
  const { log } = out(
    `getRosters - cxId ${cxId}, source ${source}, type ${type}, status ${status}`
  );
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const getRostersUrl = `${MEDICAL_ROSTER_ROUTE}`;
  const rostersParams = { source, type, status };
  try {
    const response = await executeWithNetworkRetries(() =>
      api.get<RostersResponse>(getRostersUrl, { params: { cxId, ...rostersParams } })
    );
    const rosters = response.data;
    return rosters.rosters;
  } catch (error) {
    const msg = "Failure while getting rosters @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      source,
      type,
      status,
      url: getRostersUrl,
      context: "roster.getRosters",
    });
  }
}
