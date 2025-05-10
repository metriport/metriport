import { errorToString, MetriportError } from "@metriport/shared";
import { SupportedResourceType } from "@metriport/shared/interface/external/ehr/fhir-resource";
import axios from "axios";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { ApiBaseParams } from "../api-shared";

export type RefreshEhrBundleParams = Omit<ApiBaseParams, "departmentId"> & {
  resourceType: SupportedResourceType;
};

/**
 * Refreshes the EHR bundle for the given resource type from the API.
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
    const response = await api.post(refreshBundleUrl);
    if (!response.data) throw new Error(`No body returned from ${refreshBundleUrl}`);
    debug(`${refreshBundleUrl} resp: ${JSON.stringify(response.data)}`);
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
