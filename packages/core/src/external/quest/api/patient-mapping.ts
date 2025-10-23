import { errorToString, executeWithNetworkRetries, NotFoundError } from "@metriport/shared";
import { PatientMapping, patientMappingSchema } from "../../../domain/patient-mapping";
import axios, { AxiosInstance } from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";

interface GetPatientMappingParams {
  externalId: string;
}

/**
 * Retrieves the Metriport patient ID and CX ID for a given external ID for a patient uploaded to the Quest roster.
 * @param params.externalId - The external ID for the patient
 * @param axiosInstance - An optional Axios instance to use for the API request
 * @returns The Metriport patient ID and CX ID for the patient
 */
export async function getPatientMapping(
  { externalId }: GetPatientMappingParams,
  axiosInstance?: AxiosInstance
): Promise<PatientMapping> {
  const { log } = out(`Quest getPatientMapping - externalId ${externalId}`);
  const api = axiosInstance ?? axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({ externalId });
  const getPatientMappingUrl = `/internal/quest/patient/mapping?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.get(getPatientMappingUrl);
    });
    const data = patientMappingSchema.parse(response.data);
    return data;
  } catch (error) {
    const msg = "Failure while getting patient mapping @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new NotFoundError(msg, error, {
      externalId,
      url: getPatientMappingUrl,
      context: "quest.getPatientMapping",
    });
  }
}
