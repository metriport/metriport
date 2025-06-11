import { CreateResourceDiffBundlesBaseRequest } from "../../create-resource-diff-bundle-shared";

export type RefreshEhrBundlesRequest = CreateResourceDiffBundlesBaseRequest;

export interface EhrRefreshEhrBundlesHandler {
  refreshEhrBundles(request: RefreshEhrBundlesRequest): Promise<void>;
}
