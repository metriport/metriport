import { EhrSource } from "@metriport/shared/interface/external/ehr/source";

export type CreateResourceDiffBundlesBaseRequest = {
  ehr: EhrSource;
  cxId: string;
  practiceId: string;
  metriportPatientId: string;
  ehrPatientId: string;
  contribute?: boolean;
  jobId: string;
};
