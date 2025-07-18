import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import { logAxiosResponse } from "@metriport/shared/common/response";
import axios from "axios";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { JobBaseParams } from "./shared";

export type FailJobParams = JobBaseParams & {
  reason: string;
  context: string;
};

/**
 * Marks a patient job as failed when processing cannot continue, enabling proper job lifecycle
 * management and error tracking in the discharge requery flow.
 */
export async function failJob({ jobId, cxId, reason, context }: FailJobParams): Promise<void> {
  const fullContext = `${context}.failJob`;
  const { log, debug } = out(`${fullContext} - jobId ${jobId} cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({ cxId });
  const failJobUrl = `/internal/patient/job/${jobId}/fail?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.post(failJobUrl, { reason });
    });
    logAxiosResponse(failJobUrl, response, debug);
  } catch (error) {
    const msg = "Failure while failing job @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      url: failJobUrl,
      context: fullContext,
    });
  }
}
