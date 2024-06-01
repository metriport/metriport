export type LinkDateOfBirth = string | undefined;
export type LinkGender = "male" | "female" | undefined;

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

export type LinkDemographicsComparison = {
  dob?: string;
  gender?: LinkGender;
  names?: string[];
  addresses?: string[];
  telephoneNumbers?: string[];
  emails?: string[];
  driversLicenses?: string[];
  ssns?: string[];
};

export type LinkDemographicsHistory = {
  [key: string]: LinkDemographics[];
};
