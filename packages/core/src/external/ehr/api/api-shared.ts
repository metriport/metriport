import { EhrSource } from "@metriport/shared/interface/external/ehr/source";

export type ApiBaseParams = {
  ehr: EhrSource;
  cxId: string;
  practiceId: string;
  patientId: string;
  departmentId?: string;
  tokenId?: string;
};
