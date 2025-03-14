import { BaseDomain, BaseDomainCreate } from "./base-domain";

export type Subscriptions = {
  adt?: boolean;
};

export interface PatientSettingsCreate extends BaseDomainCreate {
  id: string;
  cxId: string;
  patientId: string;
  subscribeTo: Subscriptions;
}

export interface PatientSettings extends BaseDomain, PatientSettingsCreate {}
