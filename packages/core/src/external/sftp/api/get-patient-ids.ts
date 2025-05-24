import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import axios, { AxiosInstance } from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { validateAndLogResponse } from "./shared";
import { z } from "zod";

interface GetPatientIdsParams {
  cxId: string;
  facilityId?: string;
}

const getPatientIdsResponseSchema = z.object({
  patientIds: z.array(z.string()),
});

export type GetPatientIdsResponse = z.infer<typeof getPatientIdsResponseSchema>;

/**
 * Sends a request to the API to get a patient with Metriport.
 *
 * @param cxId - The CX ID.
 * @param patientId - The patient ID.
 */
export async function getPatientIds(
  { cxId, facilityId }: GetPatientIdsParams,
  axiosInstance?: AxiosInstance
) {
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
