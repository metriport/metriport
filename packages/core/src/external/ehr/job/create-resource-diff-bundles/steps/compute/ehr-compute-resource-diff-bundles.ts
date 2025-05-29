import { CreateResourceDiffBundlesBaseRequest } from "../../create-resource-diff-bundle-shared";

export type ComputeResourceDiffBundlesRequest = CreateResourceDiffBundlesBaseRequest;

export interface EhrComputeResourceDiffBundlesHandler {
  computeResourceDiffBundles(request: ComputeResourceDiffBundlesRequest): Promise<void>;
}
