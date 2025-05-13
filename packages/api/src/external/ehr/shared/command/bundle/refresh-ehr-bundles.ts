import {
  getBundleFunctions,
  RefreshEhrBundleParams,
  RefreshEhrBundleParamsForClient,
  validateAndPrepareBundleFetchOrRefresh,
} from "../../utils/bundle";

/**
 * Refresh the EHR bundle
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID of the patient.
 * @param practiceId - The practice id of the EHR patient.
 * @param patientId - The patient id of the EHR patient.
 * @param resourceType - The resource type to fetch. Optional, all supported resource types will be fetched if not provided.
 */
export async function refreshEhrBundles({
  ehr,
  cxId,
  practiceId,
  patientId,
  resourceType,
}: RefreshEhrBundleParams): Promise<void> {
  const { refreshEhrBundle } = getBundleFunctions(ehr);
  const { metriportPatientId, resourceTypes } = await validateAndPrepareBundleFetchOrRefresh({
    ehr,
    cxId,
    patientId,
    resourceType,
  });
  for (const resourceType of resourceTypes) {
    const clientParams: RefreshEhrBundleParamsForClient = {
      ehr,
      cxId,
      practiceId,
      patientId,
      resourceType,
      metriportPatientId,
    };
    await refreshEhrBundle(clientParams);
  }
}
