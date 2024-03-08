import { Patient as PatientResource } from "@metriport/ihe-gateway-sdk/models/patient-discovery/patient-discovery-responses";
import { MedicalDataSource } from "../external";
import { Address, getState } from "./address";
import { BaseDomain, BaseDomainCreate } from "./base-domain";
import { BulkGetDocumentsUrlProgress } from "./bulk-get-document-url";
import { Contact } from "./contact";
import { DocumentQueryProgress } from "./document-query";
import { USState, getStateEnum } from "./geographic-locations";
import { QueryProgress } from "./query-status";

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

export function patientDataFromResource(patientResource: PatientResource): PatientData | undefined {
  const firstName = patientResource.name[0]?.given[0];
  const lastName = patientResource.name[0]?.family;
  const dob = patientResource.birthDate;
  const genderAtBirth = mapGender(patientResource.gender);
  const addresses = getPatientAddresses(patientResource);

  if (!firstName || !lastName || !dob || !genderAtBirth) return;
  if (!addresses.length) return;

  return {
    firstName,
    lastName,
    dob,
    genderAtBirth,
    address: addresses,
  };
}

function mapGender(string: string): "M" | "F" | undefined {
  if (string === "male") return "M";
  if (string === "female") return "F";
  return;
}
function getPatientAddresses(patientResource: PatientResource): Address[] {
  const addresses: Address[] = [];
  for (const address of patientResource.address) {
    const state = address.state ? getStateEnum(address.state) : undefined;
    if (!state) continue;
    addresses.push({
      addressLine1: address.line.join(", "),
      city: address.city,
      state,
      zip: address.postalCode,
      country: address.country,
    });
  }

  return addresses;
}
