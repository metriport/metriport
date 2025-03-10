import { EhrSource } from "../../../external/shared/ehr";

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
