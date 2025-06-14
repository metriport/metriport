import { CreateResourceDiffBundlesBaseRequest } from "../../create-resource-diff-bundle-shared";

export type ContributeResourceDiffBundlesRequest = CreateResourceDiffBundlesBaseRequest;

export interface EhrContributeResourceDiffBundlesHandler {
  contributeResourceDiffBundles(request: ContributeResourceDiffBundlesRequest): Promise<void>;
}
