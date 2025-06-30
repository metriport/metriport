import { CreateResourceDiffBundlesBaseRequest } from "../../shared";

export type EhrWriteBackResourceDiffBundlesRequest = CreateResourceDiffBundlesBaseRequest;

export interface EhrWriteBackResourceDiffBundlesHandler {
  writeBackResourceDiffBundles(request: EhrWriteBackResourceDiffBundlesRequest): Promise<void>;
}
