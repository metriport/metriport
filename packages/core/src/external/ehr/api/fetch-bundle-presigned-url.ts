import { errorToString, MetriportError } from "@metriport/shared";
import { SupportedResourceType } from "@metriport/shared/interface/external/ehr/fhir-resource";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { ApiBaseParams } from "./api-shared";

export type FetchEhrBundleParams = Omit<ApiBaseParams, "departmentId"> & {
  resourceType: SupportedResourceType;
  refresh: boolean;
};

/**
 * Fetches the EHR bundle pre-signed URLs for the given resource type from the API.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param practiceId - The practice ID.
 * @param patientId - The patient ID.
 * @param resourceType - The resource type.
 * @param refresh - Whether to refresh the bundle.
 * @returns The EHR bundle pre-signed URLs.
 */
export async function fetchEhrBundlePreSignedUrls({
  ehr,
  cxId,
  practiceId,
  patientId,
  resourceType,
  refresh,
}: FetchEhrBundleParams): Promise<{
  preSignedUrls: string;
  resourceTypes: SupportedResourceType[];
}> {
  const { log, debug } = out(`Ehr fetchBundle - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({
    cxId,
    practiceId,
    resourceType,
    refresh: refresh.toString(),
  });
  const fetchBundleUrl = `/internal/ehr/${ehr}/patient/${patientId}/resource/bundle/pre-signed-urls?${queryParams.toString()}`;
  try {
    const response = await api.get(fetchBundleUrl);
    if (!response.data) throw new Error(`No body returned from ${fetchBundleUrl}`);
    debug(`${fetchBundleUrl} resp: ${JSON.stringify(response.data)}`);
    return {
      preSignedUrls: response.data.preSignedUrls,
      resourceTypes: response.data.resourceTypes,
    };
  } catch (error) {
    const msg = "Failure while fetching EHR bundle @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      cxId,
      practiceId,
      patientId,
      resourceType,
      refresh,
      url: fetchBundleUrl,
      context: "ehr.fetchEhrBundlePreSignedUrls",
    });
  }
}
