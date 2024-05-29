import { ConsolidatedQuery } from "@metriport/api-sdk";
import { USState } from "./geographic-locations";
import { BaseDomain, BaseDomainCreate } from "./base-domain";
import { DocumentQueryProgress } from "./document-query";
import { BulkGetDocumentsUrlProgress } from "./bulk-get-document-url";
import { PatientDiscovery } from "./query-status";
import { MedicalDataSource } from "../external";
import { Address, getState } from "./address";
import { Contact } from "./contact";

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
}

export type PatientExternalData = Partial<Record<MedicalDataSource, PatientExternalDataEntry>>;

export type PatientData = {
  firstName: string;
  lastName: string;
  dob: string;
  genderAtBirth: GenderAtBirth;
  personalIdentifiers?: PersonalIdentifier[] | undefined;
  address: Address[];
  contact?: Contact[];
  requestId?: string;
  documentQueryProgress?: DocumentQueryProgress;
  consolidatedQueries?: ConsolidatedQuery[];
  patientDiscovery?: PatientDiscovery;
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

export function joinName(name: string[]): string {
  return name.join(" ");
}

export interface Patient extends BaseDomain, PatientCreate {}

export function getStatesFromAddresses(patient: Patient): USState[] {
  return patient.data.address.map(getState);
}
