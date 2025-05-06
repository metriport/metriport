import { BundleType } from "@metriport/core/external/ehr/bundle/bundle-shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { PatientJobPayload } from "../../../../command/job/patient/get";
import { FetchBundlePreSignedUrls } from "./bundle";

export type StartCreateResourceDiffBundlesJobParams = {
  ehr: EhrSources;
  cxId: string;
  practiceId: string;
  patientId: string;
  contribute?: boolean;
  requestId?: string;
};

export type GetResourceDiffBundlesJobPayloadParams = {
  ehr: EhrSources;
  cxId: string;
  practiceId: string;
  patientId: string;
  jobId: string;
  bundleType: BundleType.RESOURCE_DIFF_METRIPORT_ONLY | BundleType.RESOURCE_DIFF_EHR_ONLY;
};

export type ResourceDiffBundlesJobPayload = PatientJobPayload<FetchBundlePreSignedUrls>;

export function getCreateResourceDiffBundlesJobType(ehr: EhrSources) {
  return `${ehr}-create-resource-diff-bundles`;
}

export type StartRefreshEhrBundlesJobParams = {
  ehr: EhrSources;
  cxId: string;
  practiceId: string;
  patientId: string;
  requestId?: string;
};

export function getRefreshEhrBundlesJobType(ehr: EhrSources) {
  return `${ehr}-refresh-ehr-bundles`;
}
