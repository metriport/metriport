import { errorToString, MetriportError } from "@metriport/shared";
import {
  Bundle,
  SupportedResourceType,
} from "@metriport/shared/interface/external/ehr/fhir-resource";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { ApiBaseParams } from "./api-shared";

export type FetchBundleParams = Omit<ApiBaseParams, "departmentId"> & {
  resourceType: SupportedResourceType;
  useCachedBundle: boolean;
};

/**
 * Fetches the EHR bundle for the given resource type from the API.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param practiceId - The practice ID.
 * @param patientId - The patient ID.
 * @param resourceType - The resource type.
 * @param useCachedBundle - Whether to use the cached bundle.
 * @returns The EHR bundle.
 */
export async function fetchBundle({
  ehr,
  cxId,
  practiceId,
  patientId,
  resourceType,
  useCachedBundle,
}: FetchBundleParams): Promise<{
  bundle: Bundle;
  resourceTypes: SupportedResourceType[];
}> {
  const { log, debug } = out(`Ehr fetchBundle - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({
    cxId,
    practiceId,
    patientId,
    resourceType,
    useCachedBundle: useCachedBundle.toString(),
  });
  const fetchBundleUrl = `/internal/ehr/${ehr}/patient/bundle?${queryParams.toString()}`;
  try {
    const response = await api.get(fetchBundleUrl);
    if (!response.data) throw new Error(`No body returned from ${fetchBundleUrl}`);
    debug(`${fetchBundleUrl} resp: ${JSON.stringify(response.data)}`);
    return {
      bundle: response.data.bundle,
      resourceTypes: response.data.resourceTypes,
    };
  } catch (error) {
    const msg = "Failure while fetching bundle @ Ehr";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      cxId,
      practiceId,
      patientId,
      resourceType,
      useCachedBundle,
      url: fetchBundleUrl,
      context: "ehr.fetchBundle",
    });
  }
}
