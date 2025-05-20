import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { GetSecretsParamsResult } from "../shared";
import { ApiBaseParams, validateAndLogResponse } from "./api-shared";

export type GetTokenInfoParams = Omit<ApiBaseParams, "departmentId" | "patientId">;

/**
 * Sends a request to the API to get the client key and secret for a client.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param practiceId - The practice ID.
 */
export async function getSecrets({
  ehr,
  cxId,
  practiceId,
}: GetTokenInfoParams): Promise<GetSecretsParamsResult> {
  const { log, debug } = out(`Ehr getSecrets - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({ cxId });
  const getSecretsUrl = `/internal/ehr/${ehr}/practice/${practiceId}/secrets?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.post(getSecretsUrl);
    });
    validateAndLogResponse(getSecretsUrl, response, debug);
    return response.data;
  } catch (error) {
    const msg = "Failure while linking patient @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      cxId,
      practiceId,
      url: getSecretsUrl,
      context: `ehr.getSecrets`,
    });
  }
}
