import {
  getSupportedResourcesByEhr,
  isSupportedResourceTypeByEhr,
} from "@metriport/core/external/ehr/bundle/bundle-shared";
import { BadRequestError } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { fetchBundlePreSignedUrl as fetchBundlePreSignedUrlCanvas } from "../../../canvas/command/bundle/fetch-bundle-presigned-url";
import { refreshEhrBundle as refreshEhrBundleCanvas } from "../../../canvas/command/bundle/refresh-ehr-bundle";
import {
  FetchBundleParams,
  FetchBundleParamsForClient,
  FetchedBundlePreSignedUrls,
  RefreshEhrBundleParamsForClient,
} from "./types";

export async function validateAndPrepareBundleFetchOrRefresh({
  ehr,
  cxId,
  ehrPatientId,
  resourceType,
}: Pick<FetchBundleParams, "ehr" | "cxId" | "ehrPatientId" | "resourceType">): Promise<
  Pick<FetchedBundlePreSignedUrls, "resourceTypes"> & { metriportPatientId: string }
> {
  const patientMapping = await getPatientMappingOrFail({
    cxId,
    externalId: ehrPatientId,
    source: ehr,
  });
  const metriportPatientId = patientMapping.patientId;
  if (resourceType && !isSupportedResourceTypeByEhr(ehr, resourceType)) {
    throw new BadRequestError("Resource type is not supported for bundle", undefined, {
      resourceType,
    });
  }
  const resourceTypes = resourceType ? [resourceType] : getSupportedResourcesByEhr(ehr);
  return { resourceTypes, metriportPatientId };
}

export type BundleFunctions = {
  fetchBundlePreSignedUrl: (params: FetchBundleParamsForClient) => Promise<string | undefined>;
  refreshEhrBundle: (params: RefreshEhrBundleParamsForClient) => Promise<void>;
};

const bundleFunctionsByEhr: Record<EhrSources, BundleFunctions | undefined> = {
  [EhrSources.canvas]: {
    fetchBundlePreSignedUrl: fetchBundlePreSignedUrlCanvas,
    refreshEhrBundle: refreshEhrBundleCanvas,
  },
  [EhrSources.athena]: undefined,
  [EhrSources.elation]: undefined,
  [EhrSources.healthie]: undefined,
};

export function getBundleFunctions(ehr: EhrSources): BundleFunctions {
  const bundleFunctions = bundleFunctionsByEhr[ehr];
  if (!bundleFunctions) {
    throw new BadRequestError("No bundle functions found @ Ehr", undefined, { ehr });
  }
  return bundleFunctions;
}
