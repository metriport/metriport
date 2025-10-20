import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { ApiBaseParams, validateAndLogResponse } from "./api-shared";

export type LinkPatientParams = Omit<ApiBaseParams, "departmentId">;

/**
 * Sends a request to the API to link a patient with the EHR.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param practiceId - The practice ID.
 * @param patientId - The patient ID.
 */
export async function linkPatient({
  ehr,
  cxId,
  practiceId,
  patientId,
}: LinkPatientParams): Promise<void> {
  const { log, debug } = out(`Ehr linkPatient - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({
    cxId,
    practiceId,
    patientId,
  });
  const linkPatientUrl = `/internal/ehr/${ehr}/patient/link?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.post(linkPatientUrl);
    });
    validateAndLogResponse(linkPatientUrl, response, debug);
  } catch (error) {
    const msg = "Failure while linking patient @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      cxId,
      practiceId,
      patientId,
      url: linkPatientUrl,
      context: `ehr.linkPatient`,
    });
  }
}
