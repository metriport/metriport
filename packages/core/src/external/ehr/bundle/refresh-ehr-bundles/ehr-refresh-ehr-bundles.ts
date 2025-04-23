import { EhrSource } from "@metriport/shared/interface/external/ehr/source";

export type RefreshEhrBundlesRequest = {
  ehr: EhrSource;
  cxId: string;
  practiceId: string;
  patientId: string;
};

export interface EhrRefreshEhrBundlesHandler {
  refreshEhrBundles(request: RefreshEhrBundlesRequest): Promise<void>;
}
