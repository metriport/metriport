import { EhrSource } from "@metriport/shared/interface/external/ehr/source";

export type ProcessSyncPatientRequest = {
  ehr: EhrSource;
  cxId: string;
  practiceId: string;
  patientId: string;
  triggerDq: boolean;
};

export interface EhrSyncPatientHandler {
  processSyncPatient(request: ProcessSyncPatientRequest): Promise<void>;
}
