import { ResourceDiffBundlesBaseRequest } from "../../../shared";

export type ComputeResourceDiffBundlesRequest = ResourceDiffBundlesBaseRequest;

export interface EhrComputeResourceDiffBundlesHandler {
  computeResourceDiffBundles(request: ComputeResourceDiffBundlesRequest): Promise<void>;
}
