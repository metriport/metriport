import {
  getSupportedResourcesByEhr,
  isSupportedResourceTypeByEhr,
} from "@metriport/core/external/ehr/bundle/bundle-shared";
import { BadRequestError } from "@metriport/shared";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { fetchBundlePreSignedUrl as fetchBundlePreSignedUrlCanvas } from "../../../canvas/command/bundle/fetch-bundle-presigned-url";
import { FetchBundleParams, FetchBundleParamsForClient, FetchedBundlePreSignedUrls } from "./types";

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
};

const bundleFunctionsByEhr: Record<EhrSource, BundleFunctions | undefined> = {
  [EhrSources.canvas]: {
    fetchBundlePreSignedUrl: fetchBundlePreSignedUrlCanvas,
  },
  [EhrSources.athena]: undefined,
  [EhrSources.elation]: undefined,
  [EhrSources.healthie]: undefined,
  [EhrSources.eclinicalworks]: undefined,
};

export function getBundleFunctions(ehr: EhrSource): BundleFunctions {
  const bundleFunctions = bundleFunctionsByEhr[ehr];
  if (!bundleFunctions) {
    throw new BadRequestError("No bundle functions found @ Ehr", undefined, { ehr });
  }
  return bundleFunctions;
}
