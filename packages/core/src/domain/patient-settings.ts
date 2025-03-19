import { BaseDomain, BaseDomainCreate } from "./base-domain";
import { PatientData } from "./patient";

export type Subscriptions = {
  adt?: boolean;
};

export type PatientSettingsData = {
  subscriptions?: Subscriptions;
};

export interface PatientSettingsCreate extends BaseDomainCreate {
  cxId: string;
  patientId: string;
  subscriptions?: Subscriptions;
}

export interface PatientSettings extends BaseDomain, PatientSettingsCreate {}

export type AdtSubscriberData = {
  id: string;
  cxId: string;
} & Pick<
  PatientData,
  "firstName" | "lastName" | "dob" | "address" | "personalIdentifiers" | "genderAtBirth"
>;
