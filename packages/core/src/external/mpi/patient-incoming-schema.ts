import { USState } from "../../domain/geographic-locations";

// TODO whole file should be migrated into mirth replacement module once we pass verification with testing partners.

export type LivingSubjectId = {
  extension?: string;
  root?: string;
};

export type PrincipalCareProviderId = {
  extension?: string;
  root?: string;
};

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

export type Address = {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: USState;
  zip: string;
  country?: string;
};

export type ContactTypes = "email" | "phone";

export type Contact = Partial<Record<ContactTypes, string | undefined>>;

// modify address schema to have type of AddressLine2 be string? instead of string | undefined

export type PatientDataMPI = {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  genderAtBirth: GenderAtBirth;
  personalIdentifiers?: PersonalIdentifier[] | null;
  address?: Address[];
  contact?: Contact[];
  // TODO do something with these
  livingSubjectId?: LivingSubjectId;
  principalCareProviderId?: PrincipalCareProviderId;
  // TODO remove these.
  systemId?: string;
  docmentId?: string;
};
