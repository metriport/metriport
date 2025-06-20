import {
  errorToString,
  executeWithNetworkRetries,
  MetriportError,
  PatientJob,
} from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { logAxiosResponse } from "@metriport/shared/common/response";
import axios from "axios";

import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";

export type GetJobsParams = {
  cxId?: string;
  patientId?: string;
  jobType?: string;
  jobGroupId?: string;
  status?: string;
  scheduledAfter?: Date;
  scheduledBefore?: Date;
};

/**
 * Sends a request to the API to get jobs.
 *
 * @param cxId - The CX ID.
 * @param patientId - The patient ID.
 * @param jobType - The job type.
 * @param jobGroupId - The job group ID.
 * @param status - The status of the job.
 * @param scheduledAfter - The scheduled after date.
 * @param scheduledBefore - The scheduled before date.
 */
export async function getJobs({
  cxId,
  patientId,
  jobType,
  jobGroupId,
  status,
  scheduledAfter,
  scheduledBefore,
}: GetJobsParams): Promise<{ jobs: PatientJob[] }> {
  const { log, debug } = out(`getJobs`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({
    ...(cxId ? { cxId } : {}),
    ...(patientId ? { patientId } : {}),
    ...(jobType ? { jobType } : {}),
    ...(jobGroupId ? { jobGroupId } : {}),
    ...(status ? { status } : {}),
    ...(scheduledAfter ? { scheduledAfter: buildDayjs(scheduledAfter).toISOString() } : {}),
    ...(scheduledBefore ? { scheduledBefore: buildDayjs(scheduledBefore).toISOString() } : {}),
  });
  const getJobsUrl = `/internal/patient/job?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => api.get(getJobsUrl));
    logAxiosResponse(getJobsUrl, response, debug);
    return response.data;
  } catch (error) {
    const msg = "Failure while getting jobs @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      url: getJobsUrl,
      context: "patient-job.getJobs",
    });
  }
}
