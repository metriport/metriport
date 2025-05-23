import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { ApiBaseParams, validateAndLogResponse } from "../api-shared";

export type ContributeResourceDiffBundleParams = Omit<
  ApiBaseParams,
  "practiceId" | "departmentId"
> & {
  resourceType: string;
  jobId: string;
};

/**
 * Contributes the resource diff bundle for the given Metriport patient ID from the API.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param patientId - The patient ID.
 * @param resourceType - The resource type.
 * @param jobId - The job ID.
 */
export async function contributeResourceDiffBundle({
  ehr,
  cxId,
  patientId,
  resourceType,
  jobId,
}: ContributeResourceDiffBundleParams): Promise<void> {
  const { log, debug } = out(`Ehr contributeResourceDiffBundle - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({
    cxId,
    resourceType,
  });
  const refreshBundleUrl = `/internal/ehr/${ehr}/patient/${patientId}/resource/diff/${jobId}/contribute?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.post(refreshBundleUrl);
    });
    validateAndLogResponse(refreshBundleUrl, response, debug);
  } catch (error) {
    const msg = "Failure while contributing resource diff bundle @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      cxId,
      patientId,
      resourceType,
      jobId,
      url: refreshBundleUrl,
      context: "ehr.contributeResourceDiffBundle",
    });
  }
}
