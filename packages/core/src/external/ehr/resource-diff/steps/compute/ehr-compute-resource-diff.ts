import { FhirResource } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";

export type ComputeResourceDiffRequests = {
  ehr: EhrSource;
  cxId: string;
  practiceId: string;
  metriportPatientId: string;
  ehrPatientId: string;
  existingResources?: FhirResource[] | undefined;
  newResource: FhirResource;
  requestId: string;
  workflowId: string;
}[];

export interface EhrComputeResourceDiffHandler {
  computeResourceDiff(request: ComputeResourceDiffRequests): Promise<void>;
}
