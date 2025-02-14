import { Patient as FHIRPatient } from "@medplum/fhirtypes";
import { stripNonNumericChars } from "@metriport/shared";

export type LinkDateOfBirth = string | undefined;
export type LinkGender = FHIRPatient["gender"];

export type LinkGenericName = {
  firstName: string;
  lastName: string;
};

export type LinkGenericAddress = {
  line: string[];
  city: string;
  state: string;
  zip: string;
  country: string;
};

export type LinkGenericDriversLicense = {
  state: string;
  value: string;
};

export type LinkDemographics = {
  dob: LinkDateOfBirth;
  gender: LinkGender;
  names: string[];
  addresses: string[];
  telephoneNumbers: string[];
  emails: string[];
  driversLicenses: string[];
  ssns: string[];
};

export type LinkDemographicsComparison = Partial<LinkDemographics>;

export type LinkDemographicsHistory = {
  [key: string]: LinkDemographics[];
};

export function normalizeSsn(ssn: string): string {
  return stripNonNumericChars(ssn).slice(-9);
}
