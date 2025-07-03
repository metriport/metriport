import { ResourceDiffBundlesBaseRequest } from "../shared";

export type ContributeResourceDiffBundlesRequest = ResourceDiffBundlesBaseRequest & {
  createResourceDiffBundleJobId: string;
};

export interface EhrContributeResourceDiffBundlesHandler {
  contributeResourceDiffBundles(request: ContributeResourceDiffBundlesRequest): Promise<void>;
}
