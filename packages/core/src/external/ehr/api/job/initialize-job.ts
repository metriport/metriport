import { errorToString, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { ApiBaseParams, validateAndLogResponse } from "../api-shared";

export type InitializeJobParams = Pick<ApiBaseParams, "cxId"> & {
  jobId: string;
};

/**
 * Sends a request to the API to initialize the job.
 * @param jobId - The job ID.
 * @param cxId - The CX ID.
 */
export async function initializeJob({ jobId, cxId }: InitializeJobParams): Promise<void> {
  const { log, debug } = out(`Ehr initializeJob - jobId ${jobId} cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({ cxId });
  const initializeJobUrl = `/internal/patient/job/${jobId}/initialize?${queryParams.toString()}`;
  try {
    const response = await api.post(initializeJobUrl);
    validateAndLogResponse(initializeJobUrl, response, debug);
  } catch (error) {
    const msg = "Failure while initializing job @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      url: initializeJobUrl,
      context: "ehr.initializeJob",
    });
  }
}
