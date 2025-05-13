import { ResourceDiffBundleType } from "@metriport/core/external/ehr/bundle/bundle-shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { PatientJobPayload } from "../../../../command/job/patient/get";
import { FetchedBundlePreSignedUrls } from "./bundle/types";

export type StartCreateResourceDiffBundlesJobParams = {
  ehr: EhrSources;
  cxId: string;
  practiceId: string;
  patientId: string;
  requestId?: string;
};

export type GetResourceDiffBundlesJobPayloadParams = {
  ehr: EhrSources;
  cxId: string;
  practiceId: string;
  patientId: string;
  jobId: string;
  bundleType: ResourceDiffBundleType;
};

export type ResourceDiffBundlesJobPayload = PatientJobPayload<FetchedBundlePreSignedUrls>;

export function getCreateResourceDiffBundlesJobType(ehr: EhrSources) {
  return `${ehr}-create-resource-diff-bundles`;
}
