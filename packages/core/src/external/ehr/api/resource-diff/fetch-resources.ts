import { errorToString, FhirResource, MetriportError } from "@metriport/shared";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";
import axios from "axios";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";

export type FetchResourcesParams = {
  ehr: EhrSource;
  cxId: string;
  practiceId: string;
  patientId: string;
  resourceType: string;
  useS3: boolean;
};

/**
 * Sends a request to the API to save a resource diff.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param practiceId - The practice ID.
 * @param patientId - The patient ID.
 * @param resourceType - The resource type.
 * @param useS3 - Whether to use S3.
 */
export async function fetchResources({
  ehr,
  cxId,
  practiceId,
  patientId,
  resourceType,
  useS3,
}: FetchResourcesParams): Promise<FhirResource[]> {
  const { log, debug } = out(`Ehr fetchResources - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({
    cxId,
    practiceId,
    patientId,
    resourceType,
    useS3: useS3.toString(),
  });
  const fetchResourcesUrl = `/internal/ehr/${ehr}/patient/fetch-resources?${queryParams.toString()}`;
  try {
    const response = await api.post(fetchResourcesUrl);
    if (!response.data) throw new Error(`No body returned from ${fetchResourcesUrl}`);
    debug(`${fetchResourcesUrl} resp: ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (error) {
    const msg = `Failure while fetching resources @ Ehr`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      cxId,
      patientId,
      resourceType,
      useS3,
      url: fetchResourcesUrl,
      context: "ehr.fetchResources",
    });
  }
}
