import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { ApiBaseParams, validateAndLogResponse } from "../api-shared";

export type ContributeBundleParams = Omit<ApiBaseParams, "practiceId" | "departmentId"> & {
  resourceType: string;
  jobId: string;
};

/**
 * Sends a request to the API to contribute the bundle.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param patientId - The patient ID.
 * @param resourceType - The resource type.
 * @param jobId - The contribute bundle job ID.
 */
export async function contributeBundle({
  ehr,
  cxId,
  patientId,
  resourceType,
  jobId,
}: ContributeBundleParams): Promise<void> {
  const { log, debug } = out(`Ehr contributeResourceDiffBundle - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({
    cxId,
    resourceType,
  });
  const contributeBundleUrl = `/internal/ehr/${ehr}/patient/${patientId}/resource/contribute/${jobId}/contribute?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.post(contributeBundleUrl);
    });
    validateAndLogResponse(contributeBundleUrl, response, debug);
  } catch (error) {
    const msg = "Failure while contributing bundle @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      cxId,
      patientId,
      resourceType,
      jobId,
      url: contributeBundleUrl,
      context: "ehr.contributeBundle",
    });
  }
}
