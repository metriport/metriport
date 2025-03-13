import { BadRequestError, errorToString, MetriportError, NotFoundError } from "@metriport/shared";
import { UpdateJobSchema } from "@metriport/shared/domain/patient/patient-import/schemas";
import {
  PatientImport,
  PatientImportStatus,
} from "@metriport/shared/domain/patient/patient-import/types";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";

/**
 * Updates the status of a bulk patient import job.
 *
 * @param cxId - The customer ID.
 * @param jobId - The bulk import job ID.
 * @param status - The new status of the job.
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
  status: PatientImportStatus | "completed";
  total?: number | undefined;
  failed?: number | undefined;
  forceStatusUpdate?: boolean | undefined;
}): Promise<PatientImport> {
  const { log } = out(`PatientImport updateJobStatus - cxId ${cxId} jobId ${jobId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const url = buildUrl(cxId, jobId);
  const payload: UpdateJobSchema = { status, total, failed, forceStatusUpdate };
  try {
    log(`Updating API w/ status ${status}, paylaod ${JSON.stringify(payload)}`);
    const response = await api.post(url, payload);
    if (!response.data) {
      throw new MetriportError(`No body returned from updateJobStatus`, undefined, { url });
    }
    // intentionally casting to explicitly show that the response is of type any
    return response.data as PatientImport;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const msg = `Failure while updating job status @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    const additionalInfo = {
      url,
      cxId,
      jobId,
      status,
      context: "patient-import.updateJobStatus",
    };
    const detailMsg = error.response.data.detail ?? msg;
    if (error.response.status === 404) throw new NotFoundError(detailMsg, error, additionalInfo);
    if (error.response.status === 400) throw new BadRequestError(detailMsg, error, additionalInfo);
    throw new MetriportError(msg, error, additionalInfo);
  }
}

function buildUrl(cxId: string, jobId: string) {
  const urlParams = new URLSearchParams({ cxId, jobId });
  return `/internal/patient/bulk/${jobId}?${urlParams.toString()}`;
}
