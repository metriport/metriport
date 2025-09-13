import { errorToString, MetriportError } from "@metriport/shared";
import { UpdateJobSchema } from "@metriport/shared/domain/patient/patient-import/schemas";
import { PatientImportJobStatus } from "@metriport/shared/domain/patient/patient-import/status";
import { PatientImportJob } from "@metriport/shared/domain/patient/patient-import/types";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { withDefaultApiErrorHandling } from "../../shared/api/shared";

export type UpdateJobAtApiParams = {
  cxId: string;
  jobId: string;
  status?: PatientImportJobStatus;
  total?: number | undefined;
  /**
   * Only to be set on dry run mode - on regular mode, the successful count is incremented
   * individually as each patient is created.
   */
  successful?: number | undefined;
  failed?: number | undefined;
  forceStatusUpdate?: boolean | undefined;
};

/**
 * Updates the bulk patient import job tracking, which includes the status, and total and failed
 * counts.
 *
 * @param cxId - The customer ID.
 * @param jobId - The bulk import job ID.
 * @param status - The new status of the job.
 * @param total - The total number of patients in the job.
 * @param successful - The number of patient entries that were successful in the job (only to be set on dry run mode).
 * @param failed - The number of patient entries that failed in the job.
 * @param forceStatusUpdate - Whether to force the status update.
 * @returns the updated job.
 * @throws MetriportError if the update fails.
 */
export async function updateJobAtApi(params: UpdateJobAtApiParams): Promise<PatientImportJob> {
  const { cxId, jobId, status, total, successful, failed, forceStatusUpdate } = params;
  const { log } = out(`PatientImport updateJobAtApi - cxId ${cxId} jobId ${jobId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const url = buildUrl(cxId, jobId);
  const payload: UpdateJobSchema = { status, total, successful, failed, forceStatusUpdate };

  if (status == undefined && total == undefined && failed == undefined) {
    throw new Error("updateJobAtApi requires at least one of {status,total,failed} to be defined");
  }

  log(`Updating API w/ status ${status}, payload ${JSON.stringify(payload)}`);
  try {
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
  } catch (error) {
    const msg = `Failure while updating the bulk import job @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      url,
      context: "patient-import.updateJobAtApi",
    });
  }
}

function buildUrl(cxId: string, jobId: string) {
  const urlParams = new URLSearchParams({ cxId });
  return `/internal/patient/bulk/${jobId}?${urlParams.toString()}`;
}
