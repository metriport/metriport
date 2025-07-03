import { ResourceDiffBundlesBaseRequest } from "../shared";

export type WriteBackResourceDiffBundlesRequest = ResourceDiffBundlesBaseRequest & {
  createResourceDiffBundlesJobId: string;
};

export interface EhrWriteBackResourceDiffBundlesHandler {
  writeBackResourceDiffBundles(request: WriteBackResourceDiffBundlesRequest): Promise<void>;
}
