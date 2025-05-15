import { BundleType } from "@metriport/core/external/ehr/bundle/bundle-shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";

type BaseBundleParams = {
  ehr: EhrSources;
  cxId: string;
  practiceId: string;
  ehrPatientId: string;
  resourceType?: string;
};

export type FetchBundleParams = BaseBundleParams & { bundleType: BundleType; jobId?: string };

export type RefreshEhrBundleParams = BaseBundleParams;

export type ContributeEhrOnlyBundleParams = Omit<BaseBundleParams, "resourceType"> & {
  jobId: string;
};

type BaseBundleParamsForClient = Omit<BaseBundleParams, "ehr" | "resourceType"> & {
  resourceType: string;
  metriportPatientId: string;
};

export type FetchBundleParamsForClient = FetchBundleParams & BaseBundleParamsForClient;

export type RefreshEhrBundleParamsForClient = RefreshEhrBundleParams & BaseBundleParamsForClient;

export type FetchedBundlePreSignedUrls = {
  preSignedUrls: string[];
  resourceTypes: string[];
};
