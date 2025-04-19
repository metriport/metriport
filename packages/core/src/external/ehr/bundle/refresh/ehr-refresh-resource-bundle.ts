import { EhrSource } from "@metriport/shared/interface/external/ehr/source";

export type RefreshBundleRequest = {
  ehr: EhrSource;
  cxId: string;
  practiceId: string;
  patientId: string;
};

export interface EhrRefreshBundleHandler {
  refreshBundle(request: RefreshBundleRequest): Promise<void>;
}
