import { ConsolidatedQuery } from "@metriport/api-sdk";
import { USState } from "./geographic-locations";
import { BaseDomain, BaseDomainCreate } from "./base-domain";
import { DocumentQueryProgress } from "./document-query";
import { DiscoveryParams, ScheduledPatientDiscovery } from "./patient-discovery";
import { BulkGetDocumentsUrlProgress } from "./bulk-get-document-url";
import { MedicalDataSource } from "../external";
import { Address, getState } from "./address";
import { Contact } from "./contact";
import { LinkDemographics } from "./patient-demographics";

export const generalPersonalIdentifiers = ["ssn"] as const;
export const driversLicensePersonalIdentifier = ["driversLicense"] as const;
export type GeneralPersonalIdentifiers = (typeof generalPersonalIdentifiers)[number];
export type DriversLicensePersonalIdentifier = (typeof driversLicensePersonalIdentifier)[number];

export type Period =
  | {
      start: string;
      end?: string;
    }
  | {
      start?: string;
      end: string;
    };

export type BaseIdentifier = {
  value: string;
  period?: Period;
  assigner?: string;
};

export type PersonalIdentifier = BaseIdentifier &
  (
    | { type: GeneralPersonalIdentifiers }
    | { type: DriversLicensePersonalIdentifier; state: USState }
  );

export type DriversLicense = {
  value: string;
  state: USState;
};

export const genderAtBirthTypes = ["F", "M"] as const;
export type GenderAtBirth = (typeof genderAtBirthTypes)[number];

export abstract class PatientExternalDataEntry {
  documentQueryProgress?: DocumentQueryProgress;
  scheduledPdRequest?: ScheduledPatientDiscovery;
  discoveryParams?: DiscoveryParams;
}

export type PatientExternalData = Partial<Record<MedicalDataSource, PatientExternalDataEntry>>;

export type ConsolidatedLinkDemographics = Omit<LinkDemographics, "dob" | "gender">;

export type PatientData = {
  firstName: string;
  lastName: string;
  dob: string;
  genderAtBirth: GenderAtBirth;
  personalIdentifiers?: PersonalIdentifier[] | undefined;
  address: Address[];
  contact?: Contact[];
  requestId?: string;
  consolidatedLinkDemographics?: ConsolidatedLinkDemographics;
  documentQueryProgress?: DocumentQueryProgress;
  consolidatedQueries?: ConsolidatedQuery[];
  bulkGetDocumentsUrlProgress?: BulkGetDocumentsUrlProgress;
  externalData?: PatientExternalData;
  cxDocumentRequestMetadata?: unknown;
  cxConsolidatedRequestMetadata?: unknown;
  cxDownloadRequestMetadata?: unknown;
};

export type PatientDemoData = Pick<
  PatientData,
  "firstName" | "lastName" | "dob" | "genderAtBirth" | "personalIdentifiers" | "address" | "contact"
>;

export interface PatientCreate extends BaseDomainCreate {
  cxId: string;
  facilityIds: string[];
  externalId?: string;
  data: PatientData;
}

export function splitName(name: string): string[] {
  // splits by comma delimiter and filters out empty strings
  return name.split(/[\s,]+/).filter(str => str);
}

export function splitDob(dob: string): string[] {
  // splits by dash delimiter and filters out empty strings
  return dob.split(/[\s-]+/).filter(str => str);
}

export function joinName(name: string[]): string {
  return name.join(" ");
}

export interface Patient extends BaseDomain, PatientCreate {}

export function getStatesFromAddresses(patient: Patient): USState[] {
  return patient.data.address.map(getState);
}

export function createDriversLicensePersonalIdentifier(
  value: string,
  state: USState
): PersonalIdentifier {
  const personalIdentifier: PersonalIdentifier = {
    type: "driversLicense",
    value: value,
    state: state,
  };
  return personalIdentifier;
}
