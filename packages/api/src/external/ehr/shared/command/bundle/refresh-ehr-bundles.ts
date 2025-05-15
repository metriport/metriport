import {
  getBundleClientFunctions,
  validateAndPrepareBundleFetchOrRefresh,
} from "../../utils/bundle/functions";
import { RefreshEhrBundleParams, RefreshEhrBundleParamsForClient } from "../../utils/bundle/types";

/**
 * Refresh the EHR bundle
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID of the patient.
 * @param practiceId - The practice id of the EHR patient.
 * @param ehrPatientId - The patient id of the EHR patient.
 * @param resourceType - The resource type to fetch. Optional, all supported resource types will be fetched if not provided.
 */
export async function refreshEhrBundles({
  ehr,
  cxId,
  practiceId,
  ehrPatientId,
  resourceType,
}: RefreshEhrBundleParams): Promise<void> {
  const { refreshEhrBundle } = getBundleClientFunctions(ehr);
  const { metriportPatientId, resourceTypes } = await validateAndPrepareBundleFetchOrRefresh({
    ehr,
    cxId,
    ehrPatientId,
    resourceType,
  });
  for (const resourceType of resourceTypes) {
    const clientParams: RefreshEhrBundleParamsForClient = {
      ehr,
      cxId,
      practiceId,
      ehrPatientId,
      resourceType,
      metriportPatientId,
    };
    await refreshEhrBundle(clientParams);
  }
}
