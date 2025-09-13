import { errorToString, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { withDefaultApiErrorHandling } from "../../shared/api/shared";

export type UpdateRecordFailedAtApiParams = {
  cxId: string;
  jobId: string;
  rowNumber: number;
};

/**
 * Updates the bulk patient import job tracking to indicate the patient record as failed.
 *
 * @param cxId - The customer ID.
 * @param jobId - The bulk import job ID.
 * @param rowNumber - The row number of the patient in the CSV file.
 * @returns the updated job.
 * @throws MetriportError if the update fails.
 */
export async function updateRecordFailedAtApi(
  params: UpdateRecordFailedAtApiParams
): Promise<void> {
  const { cxId, jobId, rowNumber } = params;
  const { log } = out(
    `PatientImport updateRecordFailedAtApi - cx ${cxId} job ${jobId} row ${rowNumber}`
  );
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const url = buildUrl(cxId, jobId, rowNumber);

  log(`Updating record failed at API...`);
  try {
    await withDefaultApiErrorHandling({
      functionToRun: () => api.post(url),
      log,
      messageWhenItFails: `Failure while setting the bulk import record to failed @ PatientImport`,
      additionalInfo: {
        url,
        cxId,
        jobId,
        rowNumber,
        context: "patient-import.updateRecordFailedAtApi",
      },
    });
  } catch (error) {
    const msg = `Failure while setting the bulk import record to failed @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      url,
      context: "patient-import.updateRecordFailedAtApi",
    });
  }
}

function buildUrl(cxId: string, jobId: string, rowNumber: number) {
  const urlParams = new URLSearchParams({ cxId });
  return `/internal/patient/bulk/${jobId}/record/${rowNumber}/failed?${urlParams.toString()}`;
}
