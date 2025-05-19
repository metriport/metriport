import { EhrSource } from "@metriport/shared/interface/external/ehr/source";

export type CreateResourceDiffBundlesBaseRequest = {
  ehr: EhrSource;
  cxId: string;
  practiceId: string;
  metriportPatientId: string;
  ehrPatientId: string;
  resourceType: string;
  jobId: string;
  reportError?: boolean;
};

export function createSqsGroupId(metriportPatientId: string, resourceType: string): string {
  return `${metriportPatientId}-${resourceType}`;
}
