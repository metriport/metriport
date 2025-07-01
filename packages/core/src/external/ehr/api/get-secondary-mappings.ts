import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import axios from "axios";
import { z } from "zod";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { ApiBaseParams, validateAndLogResponse } from "./api-shared";

export type GetSecretsParams = Omit<ApiBaseParams, "cxId" | "departmentId" | "patientId">;

/**
 * Sends a request to the API to get the secondary mappings for a practice.
 *
 * @param ehr - The EHR source.
 * @param practiceId - The practice ID.
 * @param schema - The schema to validate the response against.
 */
export async function getSecondaryMappings<T>({
  ehr,
  practiceId,
  schema,
}: GetSecretsParams & { schema: z.ZodSchema<T> }): Promise<T> {
  const { log, debug } = out(`Ehr getSecondaryMappings - ehr ${ehr} practiceId ${practiceId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const getSecondaryMappingsUrl = `/internal/ehr/${ehr}/practice/${practiceId}/secondary-mappings`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.get(getSecondaryMappingsUrl);
    });
    validateAndLogResponse(getSecondaryMappingsUrl, response, debug);
    return schema.parse(response.data);
  } catch (error) {
    const msg = "Failure while getting secondary mappings @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      practiceId,
      url: getSecondaryMappingsUrl,
      context: `ehr.getSecondaryMappings`,
    });
  }
}
