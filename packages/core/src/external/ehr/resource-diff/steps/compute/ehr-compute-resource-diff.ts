import { FhirResource } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { ResourceDiffBaseRequest } from "../../resource-diff-shared";

export type ComputeResourceDiffRequest = ResourceDiffBaseRequest & {
  existingResources?: FhirResource[] | undefined;
  newResource: FhirResource;
};

export interface EhrComputeResourceDiffHandler {
  computeResourceDiff(request: ComputeResourceDiffRequest[]): Promise<void>;
}
