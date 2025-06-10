import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import { Patient, patientSchema } from "@metriport/shared/domain/patient";
import axios, { AxiosInstance } from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { validateAndLogResponse } from "./shared";

interface GetPatientParams {
  cxId: string;
  patientId: string;
}

/**
 * Sends an API request to retrieve the patient with the given ID.
 *
 * @param cxId - The CX ID.
 * @param patientId - The patient ID.
 * @returns {GetPatientResponse} patient demographic data
 */
export async function getPatient(
  { cxId, patientId }: GetPatientParams,
  axiosInstance?: AxiosInstance
): Promise<Patient> {
  const { log, debug } = out(`Quest getPatient - cxId ${cxId}`);
  const api = axiosInstance ?? axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({ cxId });
  const getPatientUrl = `/internal/patient/${patientId}?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.get(getPatientUrl);
    });
    const result = validateAndLogResponse<Patient>({
      url: getPatientUrl,
      response,
      schema: patientSchema,
      debug,
    });
    return result;
  } catch (error) {
    const msg = "Failure while getting patient @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      patientId,
      url: getPatientUrl,
      context: "quest.getPatient",
    });
  }
}
