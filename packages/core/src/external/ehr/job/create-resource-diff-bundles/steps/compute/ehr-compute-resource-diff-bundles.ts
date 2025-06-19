import { CreateResourceDiffBundlesBaseRequest } from "../../shared";

export type ComputeResourceDiffBundlesRequest = CreateResourceDiffBundlesBaseRequest;

export interface EhrComputeResourceDiffBundlesHandler {
  computeResourceDiffBundles(request: ComputeResourceDiffBundlesRequest): Promise<void>;
}
