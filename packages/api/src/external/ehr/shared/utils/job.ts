import { ResourceDiffBundleType } from "@metriport/core/external/ehr/bundle/bundle-shared";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";
import { PatientJobPayload } from "../../../../command/job/patient/get";
import { FetchedBundlePreSignedUrls } from "./bundle/types";

export type StartCreateResourceDiffBundlesJobParams = {
  ehr: EhrSource;
  cxId: string;
  practiceId: string;
  ehrPatientId: string;
  requestId?: string;
};

export type RunCreateResourceDiffBundlesJobParams = {
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

export function getCreateResourceDiffBundlesRunUrl(ehr: EhrSource) {
  return `/internal/ehr/${ehr}/job/create-resource-diff-bundles/run`;
}
