import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import axios from "axios";
import { z } from "zod";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { ApiBaseParams, validateAndLogResponse } from "./api-shared";

export type GetSecretsParams = Omit<ApiBaseParams, "departmentId" | "patientId">;

/**
 * Sends a request to the API to get the client key and secret (or api key) for a practice.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param practiceId - The practice ID.
 */
export async function getSecrets<T>({
  ehr,
  cxId,
  practiceId,
  schema,
}: GetSecretsParams & { schema: z.ZodSchema<T> }): Promise<T> {
  const { log, debug } = out(`Ehr getSecrets - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({ cxId });
  const getSecretsUrl = `/internal/ehr/${ehr}/practice/${practiceId}/secrets?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.get(getSecretsUrl);
    });
    validateAndLogResponse(getSecretsUrl, response, debug);
    return schema.parse(response.data);
  } catch (error) {
    const msg = "Failure while getting client key and secret @ Api";
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
