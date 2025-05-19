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
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param practiceId - The practice ID.
 */
export async function getTokenInfo({
  ehr,
  cxId,
  practiceId,
}: GetTokenInfoParams): Promise<JwtTokenInfo> {
  const { log, debug } = out(`Ehr getTokenInfo - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({
    cxId,
    practiceId,
  });
  const getTokenInfoUrl = `/internal/ehr/${ehr}/token-info?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.post(getTokenInfoUrl);
    });
    validateAndLogResponse(getTokenInfoUrl, response, debug);
    return response.data;
  } catch (error) {
    const msg = "Failure while linking patient @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      cxId,
      practiceId,
      url: getTokenInfoUrl,
      context: `ehr.getTokenInfo`,
    });
  }
}
