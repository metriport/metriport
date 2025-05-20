import {
  errorToString,
  executeWithNetworkRetries,
  JwtTokenInfo,
  MetriportError,
} from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { ApiBaseParams, validateAndLogResponse } from "./api-shared";

export type GetTokenInfoParams = Omit<ApiBaseParams, "departmentId" | "patientId">;

/**
 * Sends a request to the API to get the token info for a client.
 *
 * @param tokenId - The token ID.
 */
export async function getTokenInfo(tokenId: string): Promise<JwtTokenInfo> {
  const { log, debug } = out(`Ehr getTokenInfo - tokenId ${tokenId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const getTokenInfoUrl = `/internal/token/${tokenId}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.get(getTokenInfoUrl);
    });
    validateAndLogResponse(getTokenInfoUrl, response, debug);
    return {
      access_token: response.data.token,
      exp: new Date(response.data.exp),
    };
  } catch (error) {
    const msg = "Failure while getting token info @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      tokenId,
      url: getTokenInfoUrl,
      context: `ehr.getTokenInfo`,
    });
  }
}
