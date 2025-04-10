import { EhrSource } from "@metriport/shared/interface/external/ehr/source";

export type RefreshResourceDiffRequest = {
  ehr: EhrSource;
  cxId: string;
  practiceId: string;
  patientId: string;
};

export interface EhrRefreshResourceDiffHandler {
  refreshResourceDiff(request: RefreshResourceDiffRequest): Promise<void>;
}
