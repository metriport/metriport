import { ResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { PatientJobPayload } from "../../../../command/job/patient/get";
import { FetchBundlePreSignedUrls } from "./bundle";

export type CreateResourceDiffBundlesJobParams = {
  ehr: EhrSources;
  cxId: string;
  practiceId: string;
  patientId: string;
  direction: ResourceDiffDirection;
  requestId?: string;
};

export type GetResourceDiffBundlesJobPayloadParams = {
  ehr: EhrSources;
  cxId: string;
  practiceId: string;
  patientId: string;
  jobId: string;
  direction: ResourceDiffDirection;
};

export type ResourceDiffBundlesJobPayload = PatientJobPayload<FetchBundlePreSignedUrls>;

export function getCreateResourceDiffBundlesJobType(
  ehr: EhrSources,
  direction: ResourceDiffDirection
) {
  return `${ehr}-${direction}-create-resource-diff-bundles`;
}

export type RefreshEhrBundlesJobParams = {
  ehr: EhrSources;
  cxId: string;
  practiceId: string;
  patientId: string;
  requestId?: string;
};

export function getRefreshEhrBundlesJobType(ehr: EhrSources) {
  return `${ehr}-refresh-ehr-bundles`;
}
