import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import axios, { AxiosInstance } from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { validateAndLogResponse } from "./shared";
import { PatientIdsResponse, patientIdsSchema } from "@metriport/shared/domain/patient";
import { SurescriptsRequester } from "../types";

/**
 * Retrieves an array of patient IDs for a given customer and facility.
 *
 * @param params - The customer ID and facility ID
 * @returns {GetPatientIdsResponse} contains an array of patient IDs
 */
export async function getPatientIdsForFacility(
  { cxId, facilityId }: SurescriptsRequester,
  axiosInstance?: AxiosInstance
): Promise<PatientIdsResponse> {
  const { log, debug } = out(`Surescripts getPatientIds - cxId ${cxId}`);
  const api = axiosInstance ?? axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({ cxId, facilityId });
  const getPatientsUrl = `/internal/patient/ids?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.get(getPatientsUrl);
    });
    return validateAndLogResponse<PatientIdsResponse>({
      url: getPatientsUrl,
      response,
      schema: patientIdsSchema,
      debug,
    });
  } catch (error) {
    const msg = "Failure while getting patient IDs @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      facilityId,
      url: getPatientsUrl,
      context: "surescripts.getPatientIds",
    });
  }
}
