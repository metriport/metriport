import { UpdateJobSchema } from "@metriport/shared/domain/patient/patient-import/schemas";
import { PatientImportJobStatus } from "@metriport/shared/domain/patient/patient-import/status";
import { PatientImportJob } from "@metriport/shared/domain/patient/patient-import/types";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { withDefaultApiErrorHandling } from "./shared";

/**
 * Updates the bulk patient import job tracking, which includes the status, and total and failed
 * counts.
 *
 * @param cxId - The customer ID.
 * @param jobId - The bulk import job ID.
 * @param status - The new status of the job.
 * @param total - The total number of patients in the job.
 * @param failed - The number of patient entries that failed in the job.
 * @param forceStatusUpdate - Whether to force the status update.
 * @returns the updated job.
 */
export async function updateJobAtApi({
  cxId,
  jobId,
  status,
  total,
  failed,
  forceStatusUpdate,
}: {
  cxId: string;
  jobId: string;
  status?: PatientImportJobStatus;
  total?: number | undefined;
  failed?: number | undefined;
  forceStatusUpdate?: boolean | undefined;
}): Promise<PatientImportJob> {
  const { log } = out(`PatientImport updateJobAtApi - cxId ${cxId} jobId ${jobId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const url = buildUrl(cxId, jobId);
  const payload: UpdateJobSchema = { status, total, failed, forceStatusUpdate };

  if (status == undefined && total == undefined && failed == undefined) {
    throw new Error("updateJobAtApi requires at least one of {status,total,failed} to be defined");
  }

  log(`Updating API w/ status ${status}, payload ${JSON.stringify(payload)}`);
  const res = await withDefaultApiErrorHandling({
    functionToRun: () => api.post(url, payload),
    log,
    messageWhenItFails: `Failure while updating the bulk import job @ PatientImport`,
    additionalInfo: {
      url,
      cxId,
      jobId,
      status,
      context: "patient-import.updateJobAtApi",
    },
  });
  // intentionally casting to explicitly show that the response is of type any
  return res.data as PatientImportJob;
}

function buildUrl(cxId: string, jobId: string) {
  const urlParams = new URLSearchParams({ cxId });
  return `/internal/patient/bulk/${jobId}?${urlParams.toString()}`;
}
