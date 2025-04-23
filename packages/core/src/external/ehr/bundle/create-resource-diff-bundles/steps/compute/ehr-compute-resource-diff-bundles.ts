import { FhirResource } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { CreateResourceDiffBundlesBaseRequest } from "../../create-resource-diff-bundle-shared";

export type ComputeResourceDiffBundlesRequest = CreateResourceDiffBundlesBaseRequest & {
  existingResources?: FhirResource[] | undefined;
  newResource: FhirResource;
};

export interface EhrComputeResourceDiffBundlesHandler {
  computeResourceDiffBundlesMetriportOnly(
    request: ComputeResourceDiffBundlesRequest[]
  ): Promise<void>;
  computeResourceDiffBundlesEhrOnly(request: ComputeResourceDiffBundlesRequest[]): Promise<void>;
}
