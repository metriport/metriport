import { USState } from "./geographic-locations";
import { BaseDomain, BaseDomainCreate } from "./base-domain";
import { DocumentQueryProgress } from "./document-query";
import { BulkGetDocumentsUrlProgress } from "./bulk-get-document-url";
import { QueryProgress } from "./query-status";
import { MedicalDataSource } from "../external";
import { Address, getState } from "./address";
import { Contact } from "./contact";

export const generalTypes = ["passport", "ssn", "medicare"] as const;
export const driversLicenseType = ["driversLicense"] as const;
export type GeneralTypes = (typeof generalTypes)[number];
export type DriverLicenseType = (typeof driversLicenseType)[number];

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
  period?: Period;
  assigner?: string;
};
// TODO #425 reenable this when we manage to work with diff systems @ CW
// export type PersonalIdentifier = BaseIdentifier &
//   (
//     | { type: GeneralTypes; value: string; state?: never }
//     | { type: DriverLicenseType; value: string; state: USState }
//   );
export type PersonalIdentifier = BaseIdentifier & {
  type: DriverLicenseType;
  value: string;
  state: USState;
};

export type DriversLicense = {
  value: string;
  state: USState;
};

export const genderAtBirthTypes = ["F", "M"] as const;
export type GenderAtBirth = (typeof genderAtBirthTypes)[number];

export abstract class PatientExternalDataEntry {}

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
  consolidatedQuery?: QueryProgress;
  bulkGetDocumentsUrlProgress?: BulkGetDocumentsUrlProgress;
  externalData?: PatientExternalData;
  cxDocumentRequestMetadata?: unknown;
  cxConsolidatedRequestMetadata?: unknown;
};

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
