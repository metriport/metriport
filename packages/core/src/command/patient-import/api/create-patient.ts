import { BadRequestError, MetriportError, patientCreateResponseSchema } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../util/config";
import { withDefaultApiErrorHandling } from "../../shared/api/shared";
import { PatientPayload } from "../patient-import";

/**
 * Creates a patient in the API.
 *
 * @param cxId - The ID of the customer.
 * @param patientPayload - The patient payload, must include facilityId.
 * @returns The ID of the created patient.
 */
export async function createPatient({
  cxId,
  contextId,
  patientPayload,
}: {
  cxId: string;
  contextId: string;
  patientPayload: PatientPayload;
}): Promise<string> {
  const facilityId = patientPayload.facilityId;
  if (!facilityId) {
    throw new BadRequestError(`Facility ID is required`);
  }
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const patientUrl = buildUrl(cxId, facilityId, contextId);

  const { cohortIds, ...restPayload } = patientPayload;

  const requestPayload = {
    ...restPayload,
    ...(cohortIds && cohortIds.length > 0 ? { cohorts: cohortIds } : {}),
  };

  const response = await withDefaultApiErrorHandling({
    functionToRun: () => api.post(patientUrl, requestPayload),
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

function buildUrl(cxId: string, facilityId: string, contextId: string) {
  const urlParams = new URLSearchParams({
    cxId,
    facilityId,
    contextId,
  });
  return `/internal/patient?${urlParams.toString()}`;
}
