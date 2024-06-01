export type LinkGender = "male" | "female" | "unknown";

export type LinkGenericAddress = {
  line: string[];
  city: string;
  state: string;
  zip: string;
  country: string;
};

export type LinkDemographics = {
  dob: string;
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
