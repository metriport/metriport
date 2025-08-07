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

export function getContributeBundlesJobType(ehr: EhrSource, resourceType: string) {
  return `${ehr}-contribute-bundles-${resourceType}`;
}

export function getWriteBackBundlesJobType(ehr: EhrSource, resourceType: string) {
  return `${ehr}-write-back-bundles-${resourceType}`;
}

export function getRunJobUrl(ehr: EhrSource, jobType: string) {
  return `/internal/ehr/${ehr}/job/${jobType}/run`;
}

export function getCreateResourceDiffBundlesRunUrl(ehr: EhrSource) {
  return getRunJobUrl(ehr, "create-resource-diff-bundles");
}

export function getContributeBundlesRunUrl(ehr: EhrSource) {
  return getRunJobUrl(ehr, "contribute-bundles");
}

export function getWriteBackBundlesRunUrl(ehr: EhrSource) {
  return getRunJobUrl(ehr, "write-back-bundles");
}
