import { EhrSource } from "@metriport/shared/interface/external/ehr/source";

export type ResourceDiffBaseRequest = {
  ehr: EhrSource;
  cxId: string;
  practiceId: string;
  metriportPatientId: string;
  ehrPatientId: string;
  jobId: string;
};
