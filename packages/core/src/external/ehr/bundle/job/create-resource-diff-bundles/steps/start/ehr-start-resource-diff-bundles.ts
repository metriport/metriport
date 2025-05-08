import { CreateResourceDiffBundlesBaseRequest } from "../../create-resource-diff-bundle-shared";

export type StartResourceDiffBundlesRequest = CreateResourceDiffBundlesBaseRequest;

export interface EhrStartResourceDiffBundlesHandler {
  startResourceDiffBundles(request: StartResourceDiffBundlesRequest): Promise<void>;
}
