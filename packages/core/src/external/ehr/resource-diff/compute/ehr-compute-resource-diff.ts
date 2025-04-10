import { FhirResource } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { ResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";

export type ComputeResourceDiffRequest = {
  ehr: EhrSource;
  cxId: string;
  patientId: string;
  existingResources: FhirResource[];
  newResource: FhirResource;
  direction: ResourceDiffDirection;
};

export interface EhrComputeResourceDiffHandler {
  computeResourceDiff(request: ComputeResourceDiffRequest): Promise<void>;
}
