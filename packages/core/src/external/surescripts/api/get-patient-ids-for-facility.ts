import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import { PatientIdsResponse, patientIdsSchema } from "@metriport/shared/domain/patient";
import axios, { AxiosInstance } from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { validateAndLogResponse } from "./shared";

interface GetPatientIdsForFacilityParams {
  cxId: string;
  facilityId: string;
}

/**
 * Sends an API request to retrieve an array of patient IDs for a given customer and facility.
 *
 * @param params - The customer ID and facility ID
 * @returns array of patient IDs
 */
export async function getPatientIdsForFacility(
  { cxId, facilityId }: GetPatientIdsForFacilityParams,
  axiosInstance?: AxiosInstance
): Promise<string[]> {
  const { log, debug } = out(`Surescripts getPatientIdsForFacility - cxId ${cxId}`);
  const api = axiosInstance ?? axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({ cxId, facilityId });
  const getPatientsUrl = `/internal/patient/ids?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.get(getPatientsUrl);
    });
    const result = validateAndLogResponse<PatientIdsResponse>({
      url: getPatientsUrl,
      response,
      schema: patientIdsSchema,
      debug,
    });
    return result.patientIds;
  } catch (error) {
    const msg = "Failure while getting patient IDs for facility @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      facilityId,
      url: getPatientsUrl,
      context: "surescripts.getPatientIdsForFacility",
    });
  }
}
