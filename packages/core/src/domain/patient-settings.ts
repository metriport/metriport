import { BaseDomain, BaseDomainCreate } from "./base-domain";

export type Subscriptions = {
  adt?: boolean;
};

export type PatientSettingsData = {
  subscriptions?: Subscriptions;
};

export interface PatientSettingsCreate extends BaseDomainCreate {
  cxId: string;
  patientId: string;
  settings?: PatientSettingsData;
}

export interface PatientSettings extends BaseDomain, PatientSettingsCreate {}
