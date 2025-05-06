import { SupportedResourceType } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { CreateResourceDiffBundlesBaseRequest } from "../../create-resource-diff-bundle-shared";

export type ComputeResourceDiffBundlesRequest = CreateResourceDiffBundlesBaseRequest & {
  resourceType: SupportedResourceType;
  throwOnError?: boolean;
};

export interface EhrComputeResourceDiffBundlesHandler {
  computeResourceDiffBundles(request: ComputeResourceDiffBundlesRequest[]): Promise<void>;
}
