import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { validateAndLogResponse } from "./shared";

interface GetPatientParams {
  cxId: string;
  patientId: string;
}

/**
 * Sends a request to the API to get a patient with Metriport.
 *
 * @param cxId - The CX ID.
 * @param patientId - The patient ID.
 */
export async function getPatient({ cxId, patientId }: GetPatientParams) {
  const { log, debug } = out(`Surescripts getPatient - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({ cxId });
  const getPatientUrl = `/internal/patient/${patientId}?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.get(getPatientUrl);
    });
    const result = validateAndLogResponse(getPatientUrl, response, debug);

    return result;
  } catch (error) {
    const msg = "Failure while syncing patient @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      patientId,
      url: getPatientUrl,
      context: "surescripts.getPatient",
    });
  }
}
