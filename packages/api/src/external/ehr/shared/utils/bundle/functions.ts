import {
  getSupportedResourcesByEhr,
  isSupportedResourceTypeByEhr,
} from "@metriport/core/external/ehr/bundle/bundle-shared";
import { BadRequestError } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { refreshEhrBundle as refreshEhrBundleAthena } from "../../../athenahealth/command/bundle/refresh-ehr-bundle";
import { refreshEhrBundle as refreshEhrBundleCanvas } from "../../../canvas/command/bundle/refresh-ehr-bundle";
import {
  FetchBundleParams,
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

export type BundleClientFunctions = {
  refreshEhrBundle: (params: RefreshEhrBundleParamsForClient) => Promise<void>;
};

const bundleClientFunctionsByEhr: Record<EhrSources, BundleClientFunctions | undefined> = {
  [EhrSources.canvas]: {
    refreshEhrBundle: refreshEhrBundleCanvas,
  },
  [EhrSources.athena]: {
    refreshEhrBundle: refreshEhrBundleAthena,
  },
  [EhrSources.elation]: undefined,
  [EhrSources.healthie]: undefined,
  [EhrSources.eclinicalworks]: undefined,
};

export function getBundleClientFunctions(ehr: EhrSources): BundleClientFunctions {
  const bundleClientFunctions = bundleClientFunctionsByEhr[ehr];
  if (!bundleClientFunctions) {
    throw new BadRequestError("No bundle client functions found @ Ehr", undefined, { ehr });
  }
  return bundleClientFunctions;
}
