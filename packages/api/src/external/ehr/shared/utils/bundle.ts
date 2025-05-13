import {
  BundleType,
  getSupportedResourcesByEhr,
  isSupportedResourceTypeByEhr,
} from "@metriport/core/external/ehr/bundle/bundle-shared";
import { BadRequestError } from "@metriport/shared";
import { SupportedResourceType } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getPatientMappingOrFail } from "../../../../command/mapping/patient";
import { createCanvasClient } from "../../canvas/shared";

type BaseBundleParams = {
  ehr: EhrSources;
  cxId: string;
  practiceId: string;
  patientId: string;
  resourceType?: string;
};

export type FetchBundleParams = BaseBundleParams & { bundleType: BundleType; jobId?: string };

export type RefreshEhrBundleParams = BaseBundleParams;

export type ContributeEhrOnlyBundleParams = Omit<BaseBundleParams, "resourceType"> & {
  jobId: string;
};

type BaseBundleParamsForClient = Required<BaseBundleParams> & {
  resourceType: SupportedResourceType;
  metriportPatientId: string;
};

export type FetchBundleParamsForClient = FetchBundleParams & BaseBundleParamsForClient;

export type RefreshEhrBundleParamsForClient = RefreshEhrBundleParams & BaseBundleParamsForClient;

export type FetchedBundlePreSignedUrls = {
  preSignedUrls: string[];
  resourceTypes: SupportedResourceType[];
};

export async function validateAndPrepareBundleFetchOrRefresh({
  ehr,
  cxId,
  patientId,
  resourceType,
}: Pick<FetchBundleParams, "ehr" | "cxId" | "patientId" | "resourceType">): Promise<
  Pick<FetchedBundlePreSignedUrls, "resourceTypes"> & { metriportPatientId: string }
> {
  const patientMapping = await getPatientMappingOrFail({
    cxId,
    externalId: patientId,
    source: ehr,
  });
  const metriportPatientId = patientMapping.patientId;
  if (resourceType && !isSupportedResourceTypeByEhr(ehr, resourceType)) {
    throw new BadRequestError("Resource type is not supported for bundle", undefined, {
      resourceType,
    });
  }
  const resourceTypes = resourceType
    ? [resourceType as SupportedResourceType]
    : getSupportedResourcesByEhr(ehr);
  return { resourceTypes, metriportPatientId };
}

export type BundleFunctions = {
  fetchBundlePreSignedUrl: (params: FetchBundleParamsForClient) => Promise<string | undefined>;
  refreshEhrBundle: (params: RefreshEhrBundleParamsForClient) => Promise<void>;
};

const bundleFunctionsByEhr: Record<EhrSources, BundleFunctions | undefined> = {
  [EhrSources.canvas]: {
    fetchBundlePreSignedUrl: async params => {
      const canvasApi = await createCanvasClient({
        cxId: params.cxId,
        practiceId: params.practiceId,
      });
      return canvasApi.getBundleByResourceTypePreSignedUrl({
        ...params,
        canvasPatientId: params.patientId,
      });
    },
    refreshEhrBundle: async params => {
      const canvasApi = await createCanvasClient({
        cxId: params.cxId,
        practiceId: params.practiceId,
      });
      await canvasApi.getBundleByResourceType({
        ...params,
        canvasPatientId: params.patientId,
        useCachedBundle: false,
      });
    },
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
