import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import axios from "axios";
import { z } from "zod";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { getSecretsApiKeySchema, getSecretsOauthSchema } from "../secrets";
import { ApiBaseParams, validateAndLogResponse } from "./api-shared";

export type GetSecretsParams = Omit<ApiBaseParams, "departmentId" | "patientId">;

const numberOfCharactersToShow = 5;

/**
 * Sends a request to the API to get the client key and secret (or api key) for a practice.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param practiceId - The practice ID.
 * @param schema - The schema to validate the response against.
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
    validateAndLogResponse(getSecretsUrl, response, debug, maskKeys);
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

/**
 * Masks sensitive information in an object for clientKey, clientSecret, and apiKey fields,
 * keeping the first 3 characters of the value.
 * Only applies masking if the object matches the expected secrets schema.
 */
function maskKeys(data: unknown): unknown {
  const oauthResult = getSecretsOauthSchema.safeParse(data);
  if (oauthResult.success) {
    const { clientKey, clientSecret, ...rest } = oauthResult.data;
    return {
      ...rest,
      clientKey: `${clientKey.slice(0, numberOfCharactersToShow)}********`,
      clientSecret: `${clientSecret.slice(0, numberOfCharactersToShow)}********`,
    };
  }

  const apiKeyResult = getSecretsApiKeySchema.safeParse(data);
  if (apiKeyResult.success) {
    const { apiKey, ...rest } = apiKeyResult.data;
    return { ...rest, apiKey: `${apiKey.slice(0, numberOfCharactersToShow)}********` };
  }

  return data;
}
