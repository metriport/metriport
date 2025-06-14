import { CreateResourceDiffBundlesBaseRequest } from "../../shared";

export type RefreshEhrBundlesRequest = CreateResourceDiffBundlesBaseRequest;

export interface EhrRefreshEhrBundlesHandler {
  refreshEhrBundles(request: RefreshEhrBundlesRequest): Promise<void>;
}
