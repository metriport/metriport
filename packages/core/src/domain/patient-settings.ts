import { BaseDomain, BaseDomainCreate } from "./base-domain";

export interface PatientSettingsCreate extends BaseDomainCreate {
  id: string;
  cxId: string;
  patientId: string;
  adtSubscription: boolean;
}

export interface PatientSettings extends BaseDomain, PatientSettingsCreate {}
