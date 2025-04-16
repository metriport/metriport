import {
  defaultOptionsRequestNotAccepted,
  errorToString,
  executeWithNetworkRetries,
  MetriportError,
} from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";

/**
 * Starts the patient query for a patient, in the context of a bulk patient import.
 *
 * @param cxId - The ID of the customer.
 * @param patientId - The ID of the patient.
 * @param rerunPdOnNewDemographics - Whether to rerun patient discovery on new demographics.
 * @throws MetriportError if the patient query fails.
 */
export async function startPatientQuery({
  cxId,
  patientId,
  requestId,
  rerunPdOnNewDemographics,
}: {
  cxId: string;
  patientId: string;
  requestId: string;
  rerunPdOnNewDemographics?: boolean | undefined;
}): Promise<void> {
  const { log, debug } = out(
    `PatientImport startPatientQuery - cxId ${cxId} patientId ${patientId}`
  );
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const patientUrl = buildPatientDiscoveryUrl(cxId, patientId, requestId, rerunPdOnNewDemographics);
  try {
    const response = await executeWithNetworkRetries(() => api.post(patientUrl, {}), {
      ...defaultOptionsRequestNotAccepted,
    });
    if (!response.data) throw new Error(`No body returned from ${patientUrl}`);
    debug(`${patientUrl} resp: ${JSON.stringify(response.data)}`);
  } catch (error) {
    const msg = `Failure while starting patient query @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      url: patientUrl,
      cxId,
      patientId,
      rerunPdOnNewDemographics,
      context: "patient-import.startPatientQuery",
    });
  }
}

function buildPatientDiscoveryUrl(
  cxId: string,
  patientId: string,
  requestId: string,
  rerunPdOnNewDemographics?: boolean | undefined
) {
  const urlParams = new URLSearchParams({
    cxId,
    requestId,
    ...(rerunPdOnNewDemographics
      ? { rerunPdOnNewDemographics: rerunPdOnNewDemographics.toString() }
      : undefined),
  });
  return `/internal/patient/${patientId}/patient-discovery?${urlParams.toString()}`;
}
