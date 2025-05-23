import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { validateAndLogResponse } from "./shared";

interface GetPatientIdsParams {
  cxId: string;
  facilityId?: string;
}

/**
 * Sends a request to the API to get a patient with Metriport.
 *
 * @param cxId - The CX ID.
 * @param patientId - The patient ID.
 */
export async function getPatientIds({ cxId, facilityId }: GetPatientIdsParams) {
  const { log, debug } = out(`Surescripts getPatientIds - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({ cxId, ...(facilityId ? { facilityId } : {}) });
  const getPatientUrl = `/internal/patient/ids?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.get(getPatientUrl);
    });
    return validateAndLogResponse(getPatientUrl, response, debug);
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
