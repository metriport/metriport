import { ResourceDiffBundleType } from "@metriport/core/external/ehr/bundle/bundle-shared";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";
import { PatientJobPayload } from "../../../../command/job/patient/get";
import { FetchedBundlePreSignedUrls } from "./bundle/types";

export type StartBundlesJobParams = {
  ehr: EhrSource;
  cxId: string;
  practiceId: string;
  ehrPatientId: string;
  requestId?: string;
};

export type RunBundlesJobParams = {
  jobId: string;
  ehr: EhrSource;
  cxId: string;
  practiceId: string;
  metriportPatientId: string;
  ehrPatientId: string;
};

export type GetResourceDiffBundlesJobPayloadParams = {
  ehr: EhrSource;
  cxId: string;
  ehrPatientId: string;
  jobId: string;
  bundleType: ResourceDiffBundleType;
};

export type ResourceDiffBundlesJobPayload = PatientJobPayload<FetchedBundlePreSignedUrls>;

export function getCreateResourceDiffBundlesJobType(ehr: EhrSource) {
  return `${ehr}-create-resource-diff-bundles`;
}

export function getContributeBundlesJobType(ehr: EhrSource) {
  return `${ehr}-contribute-bundles`;
}

export function getWriteBackBundlesJobType(ehr: EhrSource) {
  return `${ehr}-write-back-bundles`;
}

export function getCreateResourceDiffBundlesRunUrl(ehr: EhrSource) {
  return `/internal/ehr/${ehr}/job/create-resource-diff-bundles/run`;
}

export function getContributeBundlesRunUrl(ehr: EhrSource) {
  return `/internal/ehr/${ehr}/job/contribute-bundles/run`;
}

export function getWriteBackBundlesRunUrl(ehr: EhrSource) {
  return `/internal/ehr/${ehr}/job/write-back-bundles/run`;
}
