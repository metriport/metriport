import { errorToString, MetriportError, patientCreateResponseSchema } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { PatientPayload } from "../patient-import";

/**
 * Creates a patient in the API.
 *
 * @param cxId - The ID of the customer.
 * @param facilityId - The ID of the facility.
 * @param patientPayload - The patient payload.
 * @returns The ID of the created patient.
 */
export async function createPatient({
  cxId,
  facilityId,
  patientPayload,
}: {
  cxId: string;
  facilityId: string;
  patientPayload: PatientPayload;
}): Promise<string> {
  const { log, debug } = out(`PatientImport createPatient - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const patientUrl = buildUrl(cxId, facilityId);
  try {
    const response = await api.post(patientUrl, patientPayload);
    if (!response.data) {
      throw new MetriportError(`No body returned while creating patient`, undefined, {
        patientUrl,
      });
    }
    debug(`${patientUrl} resp: ${JSON.stringify(response.data)}`);
    return patientCreateResponseSchema.parse(response.data).id;
  } catch (error) {
    const msg = `Failure while creating patient @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      facilityId,
      url: patientUrl,
      context: "patient-import.createPatient",
    });
  }
}

function buildUrl(cxId: string, facilityId: string) {
  const urlParams = new URLSearchParams({
    cxId,
    facilityId,
  });
  return `/internal/patient?${urlParams.toString()}`;
}
