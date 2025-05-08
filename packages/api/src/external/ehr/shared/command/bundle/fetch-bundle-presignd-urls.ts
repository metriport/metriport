import { isResourceDiffBundleType } from "@metriport/core/external/ehr/bundle/bundle-shared";
import { BadRequestError } from "@metriport/shared";
import {
  FetchBundleParams,
  FetchBundleParamsForClient,
  FetchedBundlePreSignedUrls,
  getBundleFunctions,
  validateAndPrepareBundleFetchOrRefresh,
} from "../../utils/bundle";

/**
 * Fetch the pre-signed URLs for the given bundle type
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID of the patient.
 * @param practiceId - The practice id of the EHR patient.
 * @param patientId - The patient id of the EHR patient.
 * @param resourceType - The resource type to fetch. Optional, all supported resource types will be fetched if not provided.
 * @param bundleType - The bundle type to fetch. Optional, the EHR bundle will be fetched if not provided.
 * @param jobId - The job id of the resource diff bundles job. Required for fetching resource diffs bundles. Ignored for EHR bundles.
 * @returns the bundle pre-signed URLs
 */
export async function fetchBundlePreSignedUrls({
  ehr,
  cxId,
  practiceId,
  patientId,
  resourceType,
  bundleType,
  jobId,
}: FetchBundleParams): Promise<FetchedBundlePreSignedUrls> {
  if (isResourceDiffBundleType(bundleType) && !jobId) {
    throw new BadRequestError("Job ID is required for resource diff bundles");
  }
  const { fetchBundlePreSignedUrl, getSupportedResourceTypes } = getBundleFunctions(ehr);
  const { metriportPatientId, preSignedUrls, resourceTypes } =
    await validateAndPrepareBundleFetchOrRefresh({
      ehr,
      cxId,
      patientId,
      resourceType,
      supportedResourceTypes: getSupportedResourceTypes(),
    });
  let resourceTypesFound = [...resourceTypes];
  for (const resourceType of resourceTypes) {
    const clientParams: FetchBundleParamsForClient = {
      ehr,
      cxId,
      practiceId,
      patientId,
      resourceType,
      metriportPatientId,
      bundleType,
      jobId,
    };
    const preSignedUrl = await fetchBundlePreSignedUrl(clientParams);
    if (preSignedUrl) {
      preSignedUrls.push(preSignedUrl);
    } else {
      resourceTypesFound = resourceTypesFound.filter(rt => rt !== resourceType);
    }
  }
  return { preSignedUrls, resourceTypes: resourceTypesFound };
}
