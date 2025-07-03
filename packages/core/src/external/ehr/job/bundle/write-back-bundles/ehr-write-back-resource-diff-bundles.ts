import { ResourceDiffBundlesBaseRequest } from "../shared";

export type WriteBackResourceDiffBundlesRequest = ResourceDiffBundlesBaseRequest & {
  createResourceDiffBundleJobId: string;
};

export interface EhrWriteBackResourceDiffBundlesHandler {
  writeBackResourceDiffBundles(request: WriteBackResourceDiffBundlesRequest): Promise<void>;
}
