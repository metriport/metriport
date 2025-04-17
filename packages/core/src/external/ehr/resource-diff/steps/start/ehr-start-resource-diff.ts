import { EhrSource } from "@metriport/shared/interface/external/ehr/source";

export type StartResourceDiffRequest = {
  ehr: EhrSource;
  cxId: string;
  practiceId: string;
  metriportPatientId: string;
  ehrPatientId: string;
  requestId: string;
  workflowId: string;
};

export interface EhrStartResourceDiffHandler {
  startResourceDiff(request: StartResourceDiffRequest): Promise<void>;
}
