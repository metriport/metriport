import { AddPatientMappingSchema } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../util/config";
import { withDefaultApiErrorHandling } from "./shared";

export type CreatePatientMappingParams = {
  cxId: string;
  jobId: string;
  rowNumber: number;
  patientId: string;
  dataPipelineRequestId: string;
};

/**
 * Creates a mapping between a patient's row number from a bulk import job and the respective patient ID.
 *
 * @param cxId - The ID of the customer.
 * @param jobId - The ID of the bulk import job.
 * @param rowNumber - The row number of the patient record in the CSV file.
 * @param patientId - The ID of the patient.
 * @param dataPipelineRequestId - The ID of the data pipeline request that creates/populates the patient.
 */
export async function createPatientMapping({
  cxId,
  jobId,
  rowNumber,
  patientId,
  dataPipelineRequestId,
}: CreatePatientMappingParams): Promise<void> {
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const url = buildUrl(jobId);
  const payload: AddPatientMappingSchema = {
    cxId,
    jobId,
    rowNumber,
    patientId,
    dataPipelineRequestId,
  };

  await withDefaultApiErrorHandling({
    functionToRun: () => api.post(url, payload),
    messageWhenItFails: `Failure while creating patient mapping @ PatientImport`,
    additionalInfo: {
      ...payload,
      url,
      context: "patient-import.createPatientMapping",
    },
  });
}

function buildUrl(jobId: string) {
  return `/internal/patient/bulk/${jobId}/patient-mapping`;
}
