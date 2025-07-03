import { ResourceDiffBundlesBaseRequest } from "../shared";

export type ContributeResourceDiffBundlesRequest = ResourceDiffBundlesBaseRequest & {
  createResourceDiffBundlesJobId: string;
};

export interface EhrContributeResourceDiffBundlesHandler {
  contributeResourceDiffBundles(request: ContributeResourceDiffBundlesRequest): Promise<void>;
}
