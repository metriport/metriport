import { CreateResourceDiffBundlesBaseRequest } from "../../create-resource-diff-bundle-shared";

export type StartResourceDiffBundlesRequest = CreateResourceDiffBundlesBaseRequest;

export interface EhrStartResourceDiffBundlesHandler {
  startResourceDiffBundlesMetriportOnly(request: StartResourceDiffBundlesRequest): Promise<void>;
  startResourceDiffBundlesEhrOnly(request: StartResourceDiffBundlesRequest): Promise<void>;
}
