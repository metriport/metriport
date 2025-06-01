import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import { z } from "zod";
import axios, { AxiosInstance } from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { validateAndLogResponse } from "./shared";

interface GetPatientIdsParams {
  cxId: string;
  facilityId?: string | undefined;
}

export const getPatientIdsResponseSchema = z.object({
  patientIds: z.array(z.string()),
});
export type GetPatientIdsResponse = z.infer<typeof getPatientIdsResponseSchema>;

/**
 * Retrieves an array of patient IDs for a given customer and facility.
 *
 * @param cxId - The customer ID.
 * @param facilityId - The facility ID
 * @returns {GetPatientIdsResponse} contains an array of patient IDs
 */
export async function getPatientIds(
  { cxId, facilityId }: GetPatientIdsParams,
  axiosInstance?: AxiosInstance
): Promise<GetPatientIdsResponse> {
  const { log, debug } = out(`Surescripts getPatientIds - cxId ${cxId}`);
  const api = axiosInstance ?? axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({ cxId, ...(facilityId ? { facilityId } : {}) });
  const getPatientUrl = `/internal/patient/ids?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.get(getPatientUrl);
    });
    return validateAndLogResponse<GetPatientIdsResponse>({
      url: getPatientUrl,
      response,
      schema: getPatientIdsResponseSchema,
      debug,
    });
  } catch (error) {
    const msg = "Failure while getting patient IDs @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      facilityId,
      url: getPatientUrl,
      context: "surescripts.getPatientIds",
    });
  }
}
