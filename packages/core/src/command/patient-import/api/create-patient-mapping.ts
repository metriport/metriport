import { AddPatientMappingSchema, errorToString, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";

export type CreatePatientMappingParams = {
  cxId: string;
  jobId: string;
  rowNumber: number;
  patientId: string;
  requestId: string;
};

/**
 * Creates a mapping between a patient's row number from a bulk import job and the respective patient ID.
 *
 * @param cxId - The ID of the customer.
 * @param jobId - The ID of the bulk import job.
 * @param rowNumber - The row number of the patient record in the CSV file.
 * @param patientId - The ID of the patient.
 * @param requestId - The ID of the data pipeline request that creates/populates the patient.
 */
export async function createPatientMapping({
  cxId,
  jobId,
  rowNumber,
  patientId,
  requestId,
}: CreatePatientMappingParams): Promise<void> {
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const url = buildUrl(jobId);
  try {
    const payload: AddPatientMappingSchema = {
      cxId,
      jobId,
      rowNumber,
      patientId,
      requestId,
    };
    await api.post(url, payload);
  } catch (error) {
    const { log } = out(`PatientImport createPatientMapping - cx ${cxId}, job ${jobId}`);
    const msg =
      `Failure while creating patient mapping @ PatientImport, row ${rowNumber}, ` +
      `patient ${patientId}, request ${requestId}`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      rowNumber,
      patientId,
      requestId,
      context: "patient-import.createPatientMapping",
    });
  }
}

function buildUrl(jobId: string) {
  return `/internal/patient/bulk/${jobId}/patient-mapping`;
}
