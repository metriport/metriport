import { ResourceDiffBundlesBaseRequest } from "../../../shared";

export type RefreshEhrBundlesRequest = ResourceDiffBundlesBaseRequest;

export interface EhrRefreshEhrBundlesHandler {
  refreshEhrBundles(request: RefreshEhrBundlesRequest): Promise<void>;
}
