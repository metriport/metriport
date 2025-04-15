import { errorToString, MetriportError } from "@metriport/shared";
import {
  Bundle,
  SupportedResourceType,
} from "@metriport/shared/interface/external/ehr/fhir-resource";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";

export type FetchBundleParams = {
  ehr: EhrSource;
  cxId: string;
  practiceId: string;
  patientId: string;
  resourceType: SupportedResourceType;
  useExistingBundle: boolean;
};

/**
 * Sends a request to the API to save a resource diff.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param practiceId - The practice ID.
 * @param patientId - The patient ID.
 * @param resourceType - The resource type.
 * @param useExistingBundle - Whether to use the existing bundle.
 */
export async function fetchBundle({
  ehr,
  cxId,
  practiceId,
  patientId,
  resourceType,
  useExistingBundle,
}: FetchBundleParams): Promise<Bundle> {
  const { log, debug } = out(`Ehr fetchBundle - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({
    cxId,
    practiceId,
    patientId,
    resourceType,
    useExistingBundle: useExistingBundle.toString(),
  });
  const fetchBundleUrl = `/internal/ehr/${ehr}/patient/bundle?${queryParams.toString()}`;
  try {
    const response = await api.get(fetchBundleUrl);
    if (!response.data) throw new Error(`No body returned from ${fetchBundleUrl}`);
    debug(`${fetchBundleUrl} resp: ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (error) {
    const msg = `Failure while fetching bundle @ Ehr`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      cxId,
      practiceId,
      patientId,
      resourceType,
      useExistingBundle,
      url: fetchBundleUrl,
      context: "ehr.fetchBundle",
    });
  }
}
