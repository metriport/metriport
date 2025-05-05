import {
  FetchBundleParams,
  FetchBundleParamsFromClient,
  FetchBundleParamsResourceDiff,
  FetchBundleParamsResourceDiffFromClient,
  FetchBundlePreSignedUrls,
  getBundleFunctions,
  validateAndPrepareBundleFetch,
} from "../utils/bundle";

/**
 * Fetch the pre-signed URLs for the EHR bundle
 *
 * @param ehr - The EHR source.
 * @param cxId The CX ID of the patient
 * @param practiceId - The practice id of the EHR patient.
 * @param ehrPatientId - The EHR patient id of the patient.
 * @param resourceType The resource type to fetch. Optional, all resource types will be fetched if not provided.
 * @param refresh Whether to refresh the bundle. Optional, defaults to false.
 * @returns EHR bundle pre-signed URLs
 */
export async function fetchBundlePreSignedUrls({
  ehr,
  cxId,
  practiceId,
  patientId,
  resourceType,
  refresh = false,
}: FetchBundleParams & { refresh?: boolean }): Promise<FetchBundlePreSignedUrls> {
  const { refreshBundle, fetchBundlePreSignedUrl, getSupportedResourceTypes } =
    getBundleFunctions(ehr);
  const { metriportPatientId, preSignedUrls, resourceTypes } = await validateAndPrepareBundleFetch({
    ehr,
    cxId,
    patientId,
    resourceType,
    supportedResourceTypes: getSupportedResourceTypes(),
  });
  let resourceTypesFound = [...resourceTypes];
  for (const resourceType of resourceTypes) {
    const bundleParamsWithResourceType: FetchBundleParamsFromClient = {
      ehr,
      cxId,
      practiceId,
      patientId,
      resourceType,
      metriportPatientId,
    };
    if (refresh) await refreshBundle(bundleParamsWithResourceType);
    const preSignedUrl = await fetchBundlePreSignedUrl(bundleParamsWithResourceType);
    if (preSignedUrl) {
      preSignedUrls.push(preSignedUrl);
    } else {
      resourceTypesFound = resourceTypesFound.filter(rt => rt !== resourceType);
    }
  }
  return { preSignedUrls, resourceTypes: resourceTypesFound };
}

/**
 * Fetch the pre-signed URLs for the resource diff bundles
 *
 * @param ehr - The EHR source.
 * @param cxId The CX ID of the patient
 * @param practiceId - The practice id of the EHR patient.
 * @param patientId - The patient id of the patient.
 * @param resourceType The resource type to fetch. Optional, all resource types will be fetched if not provided.
 * @param direction The direction of the resource diff bundle to fetch. Optional, defaults to both.
 * @param jobId The job id of the job. Optional, defaults to a new UUID.
 * @returns resource diff bundles pre-signed URLs
 * @throws NotFoundError if no job is found
 */
export async function fetchResourceDiffBundlesPreSignedUrls({
  ehr,
  cxId,
  practiceId,
  patientId,
  resourceType,
  direction,
  jobId,
}: FetchBundleParamsResourceDiff): Promise<FetchBundlePreSignedUrls> {
  const { fetchBundlePreSignedUrl, getSupportedResourceTypes } = getBundleFunctions(ehr);
  const { metriportPatientId, preSignedUrls, resourceTypes } = await validateAndPrepareBundleFetch({
    ehr,
    cxId,
    patientId,
    resourceType,
    supportedResourceTypes: getSupportedResourceTypes(),
  });
  let resourceTypesFound = [...resourceTypes];
  for (const resourceType of resourceTypes) {
    const bundleParamsWithResourceType: FetchBundleParamsResourceDiffFromClient = {
      ehr,
      cxId,
      practiceId,
      patientId,
      resourceType,
      metriportPatientId,
      direction,
      jobId,
    };
    const preSignedUrl = await fetchBundlePreSignedUrl(bundleParamsWithResourceType);
    if (preSignedUrl) {
      preSignedUrls.push(preSignedUrl);
    } else {
      resourceTypesFound = resourceTypesFound.filter(rt => rt !== resourceType);
    }
  }
  return { preSignedUrls, resourceTypes: resourceTypesFound };
}
