import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import { PatientMapping, patientMappingSchema } from "../../../domain/patient-mapping";
import axios, { AxiosInstance } from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { validateAndLogResponse } from "./shared";

interface GetPatientMappingParams {
  externalId: string;
}

/**
 * Sends an API request to retrieve an array of patient IDs for a given customer and facility.
 *
 * @param params - The customer ID and facility ID
 * @returns array of patient IDs
 */
export async function getPatientMapping(
  { externalId }: GetPatientMappingParams,
  axiosInstance?: AxiosInstance
): Promise<PatientMapping> {
  const { log, debug } = out(`Quest getPatientMapping - externalId ${externalId}`);
  const api = axiosInstance ?? axios.create({ baseURL: Config.getApiUrl() });
  const getPatientMappingUrl = `/internal/quest/patient/${externalId}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.get(getPatientMappingUrl);
    });
    const result = validateAndLogResponse<PatientMapping>({
      url: getPatientMappingUrl,
      response,
      schema: patientMappingSchema,
      debug,
    });
    return result;
  } catch (error) {
    const msg = "Failure while getting patient mapping @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      externalId,
      url: getPatientMappingUrl,
      context: "quest.getPatientMapping",
    });
  }
}
