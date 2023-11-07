import { BaseDomain, BaseDomainCreate } from "../../domain/base-domain";
import { DocumentQueryProgress } from "../../domain/medical/document-query";
import { QueryProgress } from "../../domain/medical/query-status";
import { MedicalDataSource } from "../../external";
import { USState } from "@metriport/core/domain/geographic-locations";
import { Address } from "./address";
import { Contact } from "./contact";

export const generalTypes = ["passport", "ssn", "medicare"] as const;
export const driversLicenseType = ["driversLicense"] as const;
export type GeneralTypes = (typeof generalTypes)[number];
export type DriverLicenseType = (typeof driversLicenseType)[number];

// TODO move this to the domain folder
export type Period =
  | {
      start: string;
      end?: string;
    }
  | {
      start?: string;
      end: string;
    };

// TODO move this to the domain folder
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
// TODO move this to the domain folder
export type PersonalIdentifier = BaseIdentifier & {
  type: DriverLicenseType;
  value: string;
  state: USState;
};

// TODO move this to the domain folder
export type DriversLicense = {
  value: string;
  state: USState;
};

// TODO move this to the domain folder
export const genderAtBirthTypes = ["F", "M"] as const;
export type GenderAtBirth = (typeof genderAtBirthTypes)[number];

// TODO move this to the domain folder
export abstract class PatientExternalDataEntry {}

// TODO move this to the domain folder
export type PatientExternalData = Partial<Record<MedicalDataSource, PatientExternalDataEntry>>;

// TODO move this to the domain folder
export type PatientData = {
  firstName: string;
  lastName: string;
  dob: string;
  genderAtBirth: GenderAtBirth;
  personalIdentifiers?: PersonalIdentifier[] | null;
  address: Address[];
  contact?: Contact[];
  documentQueryProgress?: DocumentQueryProgress;
  consolidatedQuery?: QueryProgress;
  externalData?: PatientExternalData;
  cxDocumentRequestMetadata?: unknown;
  cxConsolidatedRequestMetadata?: unknown;
};

// TODO move this to the domain folder
export interface PatientCreate extends BaseDomainCreate {
  cxId: string;
  facilityIds: string[];
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
