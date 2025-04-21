import { FhirResource } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";

export type ComputeResourceDiffRequest = {
  ehr: EhrSource;
  cxId: string;
  practiceId: string;
  metriportPatientId: string;
  ehrPatientId: string;
  existingResources?: FhirResource[] | undefined;
  newResource: FhirResource;
};

export interface EhrComputeResourceDiffHandler {
  computeResourceDiff(request: ComputeResourceDiffRequest[]): Promise<void>;
}
