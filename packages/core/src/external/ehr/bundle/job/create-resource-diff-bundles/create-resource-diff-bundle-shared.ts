import { SupportedResourceType } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";

export type CreateResourceDiffBundlesBaseRequest = {
  ehr: EhrSource;
  cxId: string;
  practiceId: string;
  metriportPatientId: string;
  ehrPatientId: string;
  resourceType: SupportedResourceType;
  jobId: string;
  reportError?: boolean;
};

export function createSqsGroupId(
  metriportPatientId: string,
  resourceType: SupportedResourceType
): string {
  return `${metriportPatientId}-${resourceType}`;
}
