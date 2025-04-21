import { ResourceDiffBaseRequest } from "../../resource-diff-shared";

export type StartResourceDiffRequest = ResourceDiffBaseRequest;

export interface EhrStartResourceDiffHandler {
  startResourceDiff(request: StartResourceDiffRequest): Promise<void>;
}
