import { CreateResourceDiffBundlesBaseRequest } from "../../shared";

export type ContributeResourceDiffBundlesRequest = CreateResourceDiffBundlesBaseRequest;

export interface EhrContributeResourceDiffBundlesHandler {
  contributeResourceDiffBundles(request: ContributeResourceDiffBundlesRequest): Promise<void>;
}
