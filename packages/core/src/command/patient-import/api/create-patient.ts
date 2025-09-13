import { MetriportError, patientCreateResponseSchema } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../util/config";
import { withDefaultApiErrorHandling } from "../../shared/api/shared";
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
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const patientUrl = buildUrl(cxId, facilityId);

  const response = await withDefaultApiErrorHandling({
    functionToRun: () => api.post(patientUrl, patientPayload),
    messageWhenItFails: `Failure while creating patient @ PatientImport`,
    additionalInfo: {
      cxId,
      facilityId,
      patientUrl,
      context: "patient-import.createPatient",
    },
  });

  if (!response.data) {
    throw new MetriportError(`No body returned while creating patient`, undefined, {
      patientUrl,
    });
  }
  return patientCreateResponseSchema.parse(response.data).id;
}

function buildUrl(cxId: string, facilityId: string) {
  const urlParams = new URLSearchParams({
    cxId,
    facilityId,
  });
  return `/internal/patient?${urlParams.toString()}`;
}
