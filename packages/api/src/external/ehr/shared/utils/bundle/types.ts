import { BundleType } from "@metriport/core/external/ehr/bundle/bundle-shared";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";

type BaseBundleParams = {
  ehr: EhrSource;
  cxId: string;
  ehrPatientId: string;
};

export type FetchBundleParams = BaseBundleParams & {
  resourceType?: string;
  bundleType: BundleType;
  jobId?: string;
};

export type ContributeBundleParams = BaseBundleParams & {
  resourceType: string;
  jobId: string;
};

export type FetchedBundlePreSignedUrls = {
  preSignedUrls: string[];
  resourceTypes: string[];
};
