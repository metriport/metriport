import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { ApiBaseParams, validateAndLogResponse } from "../api-shared";

export type RefreshEhrBundleParams = Omit<ApiBaseParams, "departmentId"> & {
  resourceType: string;
};

/**
 * Sends a request to the API to refresh the EHR bundle for the given resource type.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param practiceId - The practice ID.
 * @param patientId - The patient ID.
 * @param resourceType - The resource type.
 */
export async function refreshEhrBundle({
  ehr,
  cxId,
  practiceId,
  patientId,
  resourceType,
}: RefreshEhrBundleParams): Promise<void> {
  const { log, debug } = out(`Ehr refreshEhrBundle - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({
    cxId,
    practiceId,
    resourceType,
  });
  const refreshBundleUrl = `/internal/ehr/${ehr}/patient/${patientId}/resource/bundle/refresh?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.post(refreshBundleUrl);
    });
    validateAndLogResponse(refreshBundleUrl, response, debug);
  } catch (error) {
    const msg = "Failure while refreshing EHR bundle @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      cxId,
      practiceId,
      patientId,
      resourceType,
      url: refreshBundleUrl,
      context: "ehr.refreshEhrBundle",
    });
  }
}
