import { errorToString, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";

/**
 * Sends a request to the API to link a patient with Elation.
 *
 * @param cxId - The CX ID.
 * @param practiceId - The practice ID.
 * @param patientId - The patient ID.
 */
export async function linkPatient({
  cxId,
  practiceId,
  patientId,
}: {
  cxId: string;
  practiceId: string;
  patientId: string;
}): Promise<void> {
  const { log, debug } = out(`Ehr linkPatient - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({
    cxId,
    practiceId,
    patientId,
  });
  const linkPatientUrl = `/internal/ehr/elation/patient/link?${queryParams.toString()}`;
  try {
    const response = await api.post(linkPatientUrl);
    if (!response.data) throw new Error(`No body returned from ${linkPatientUrl}`);
    debug(`${linkPatientUrl} resp: ${JSON.stringify(response.data)}`);
  } catch (error) {
    const msg = `Failure while linking patient @ Ehr`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      practiceId,
      patientId,
      url: linkPatientUrl,
      context: "ehr.linkPatient",
    });
  }
}
