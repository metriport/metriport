import { USState } from "../..";
import { GeneralPersonalIdentifiers, DriversLicensePersonalIdentifier } from "./demographics";

export type PatientDTO = {
  id: string;
  eTag?: string;
  firstName: string;
  lastName: string;
  dob: string;
  genderAtBirth: "M" | "F";
  personalIdentifiers?: PersonalIdentifier[];
  facilityIds: string[];
  externalId?: string;
  dateCreated?: Date;
  address: Address | Address[];
  contact?: Contact | Contact[];
};

type Coordinates = {
  lat: number;
  lon: number;
};

type Address = {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  coordinates?: Coordinates;
};

type PersonalIdentifier = {
  value: string;
  period?:
    | {
        start: string;
        end?: string;
      }
    | {
        start?: string;
        end: string;
      };
  assigner?: string;
  type: GeneralPersonalIdentifiers | DriversLicensePersonalIdentifier;
  state?: keyof typeof USState;
};

type Contact = {
  phone?: string | undefined;
  email?: string | undefined;
};
