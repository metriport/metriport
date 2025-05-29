import {
  fetchBundlePreSignedUrl,
  FetchBundlePreSignedUrlParams,
} from "@metriport/core/external/ehr/bundle/command/fetch-bundle";
import { validateAndPrepareBundleFetch } from "../../utils/bundle/functions";
import { FetchBundleParams, FetchedBundlePreSignedUrls } from "../../utils/bundle/types";

/**
 * Fetch the pre-signed URLs for the given bundle type
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID of the patient.
 * @param ehrPatientId - The patient id of the EHR patient.
 * @param resourceType - The resource type to fetch. Optional, all supported resource types will be fetched if not provided.
 * @param bundleType - The bundle type to fetch. Optional, the EHR bundle will be fetched if not provided.
 * @param jobId - The job id of the resource diff bundles job. Required for fetching resource diffs bundles. Ignored for EHR bundles.
 * @returns the bundle pre-signed URLs
 */
export async function fetchBundlePreSignedUrls({
  ehr,
  cxId,
  ehrPatientId,
  resourceType,
  bundleType,
  jobId,
}: FetchBundleParams): Promise<FetchedBundlePreSignedUrls> {
  const { metriportPatientId, resourceTypes } = await validateAndPrepareBundleFetch({
    ehr,
    cxId,
    ehrPatientId,
    resourceType,
  });
  const preSignedUrls: string[] = [];
  let resourceTypesFound = [...resourceTypes];
  for (const resourceType of resourceTypes) {
    const fetchParams: FetchBundlePreSignedUrlParams = {
      ehr,
      cxId,
      ehrPatientId,
      resourceType,
      metriportPatientId,
      bundleType,
      jobId,
    };
    const preSignedUrl = await fetchBundlePreSignedUrl(fetchParams);
    if (preSignedUrl) {
      preSignedUrls.push(preSignedUrl);
    } else {
      resourceTypesFound = resourceTypesFound.filter(rt => rt !== resourceType);
    }
  }
  return { preSignedUrls, resourceTypes: resourceTypesFound };
}
