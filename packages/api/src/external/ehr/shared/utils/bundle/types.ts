import { BundleType } from "@metriport/core/external/ehr/bundle/bundle-shared";
import { SupportedResourceType } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";

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

type BaseBundleParamsForClient = Omit<BaseBundleParams, "ehr" | "resourceType"> & {
  resourceType: SupportedResourceType;
  metriportPatientId: string;
};

export type FetchBundleParamsForClient = FetchBundleParams & BaseBundleParamsForClient;

export type RefreshEhrBundleParamsForClient = RefreshEhrBundleParams & BaseBundleParamsForClient;

export type FetchedBundlePreSignedUrls = {
  preSignedUrls: string[];
  resourceTypes: SupportedResourceType[];
};
