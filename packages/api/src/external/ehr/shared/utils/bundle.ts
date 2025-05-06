import { BundleType } from "@metriport/core/external/ehr/bundle/bundle-shared";
import { supportedCanvasResources } from "@metriport/core/external/ehr/canvas/index";
import { BadRequestError } from "@metriport/shared";
import { SupportedResourceType } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getPatientMappingOrFail } from "../../../../command/mapping/patient";
import { createCanvasClient } from "../../canvas/shared";

export type FetchBundleParams = {
  ehr: EhrSources;
  cxId: string;
  practiceId: string;
  patientId: string;
  resourceType?: SupportedResourceType;
};

export type FetchBundleParamsResourceDiff = FetchBundleParams & {
  bundleType: BundleType;
  jobId: string;
};

type FetchBundleClientParams = {
  metriportPatientId: string;
  resourceType: SupportedResourceType;
};

export type FetchBundleParamsFromClient = FetchBundleParams & FetchBundleClientParams;

export type FetchBundleParamsResourceDiffFromClient = FetchBundleParamsResourceDiff &
  FetchBundleClientParams;

export type FetchBundlePreSignedUrls = {
  preSignedUrls: string[];
  resourceTypes: SupportedResourceType[];
};

export async function validateAndPrepareBundleFetch({
  ehr,
  cxId,
  patientId,
  resourceType,
  supportedResourceTypes,
}: Pick<FetchBundleParams, "ehr" | "cxId" | "patientId" | "resourceType"> & {
  supportedResourceTypes: SupportedResourceType[];
}): Promise<
  FetchBundlePreSignedUrls & {
    metriportPatientId: string;
  }
> {
  const patientMapping = await getPatientMappingOrFail({
    cxId,
    externalId: patientId,
    source: ehr,
  });
  const metriportPatientId = patientMapping.patientId;
  if (resourceType && !supportedResourceTypes.includes(resourceType)) {
    throw new BadRequestError("Resource type is not supported for bundle", undefined, {
      resourceType,
    });
  }
  const preSignedUrls: string[] = [];
  const resourceTypes = resourceType ? [resourceType] : supportedResourceTypes;
  return { preSignedUrls, resourceTypes, metriportPatientId };
}

export type BundleFunctions = {
  refreshBundle: (params: FetchBundleParamsFromClient) => Promise<void>;
  fetchBundlePreSignedUrl: (
    params: FetchBundleParamsFromClient | FetchBundleParamsResourceDiffFromClient
  ) => Promise<string | undefined>;
  getSupportedResourceTypes: () => SupportedResourceType[];
};

const bundleFunctionsByEhr: Record<EhrSources, BundleFunctions | undefined> = {
  [EhrSources.canvas]: {
    refreshBundle: async params => {
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
    getSupportedResourceTypes: () => supportedCanvasResources,
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

export type ContributeEhrOnlyBundleParams = {
  ehr: EhrSources;
  cxId: string;
  practiceId: string;
  patientId: string;
  jobId: string;
};
