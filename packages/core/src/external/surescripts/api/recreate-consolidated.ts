import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import { z } from "zod";
import axios, { AxiosInstance } from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { validateAndLogResponse } from "./shared";

interface RecreateConsolidatedParams {
  cxId: string;
  patientId: string;
}

interface RecreateConsolidatedResponse {
  requestId: string;
}

const recreateConsolidatedResponseSchema = z.object({
  requestId: z.string(),
});

/**
 * Sends an API request to retrieve the patient with the given ID.
 *
 * @param params - The customer ID and patient ID
 * @returns patient demographic data
 */
export async function recreateConsolidatedBundle(
  { cxId, patientId }: RecreateConsolidatedParams,
  axiosInstance?: AxiosInstance
): Promise<RecreateConsolidatedResponse> {
  const { log, debug } = out(`Surescripts recreateConsolidated - cxId ${cxId}`);
  const api = axiosInstance ?? axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({ cxId });
  const refreshConsolidatedUrl = `/internal/patient/${patientId}/consolidated/refresh?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.post(refreshConsolidatedUrl);
    });
    const result = validateAndLogResponse<RecreateConsolidatedResponse>({
      url: refreshConsolidatedUrl,
      response,
      schema: recreateConsolidatedResponseSchema,
      debug,
    });
    return result;
  } catch (error) {
    const msg = "Failure while refreshing consolidated bundle @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      patientId,
      url: refreshConsolidatedUrl,
      context: "surescripts.refreshConsolidatedBundle",
    });
  }
}
