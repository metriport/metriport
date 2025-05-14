import { USState } from "@metriport/shared";
import { Patient } from "../../domain/patient";
import { Hl7v2Subscription } from "../../domain/patient-settings";

export type SftpConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  remotePath: string;
};

export const addressFields = ["addressLine1", "addressLine2", "city", "state", "zip"] as const;
export type AddressField = (typeof addressFields)[number];
export type HieAddressFieldMapping = {
  [K in AddressField]: string;
};

export type MetriportToHieFieldMapping = {
  scrambledId: string;
  firstName: string;
  lastName: string;
  dob: string;
  genderAtBirth: string;
  ssn?: string;
  phone?: string;
  email?: string;
  driversLicense?: string;
  address: HieAddressFieldMapping[];
};

export type HieConfig = {
  name: string;
  states: USState[];
  subscriptions: Hl7v2Subscription[];
  cron: string;
  sftpConfig?: SftpConfig;
  mapping: MetriportToHieFieldMapping;
};

export type Hl7v2SubscriberParams = {
  states?: string | undefined;
  subscriptions: Hl7v2Subscription[];
  count?: number | undefined;
};

export type Hl7v2RosterUploadDetails = {
  fileLocation: string;
  fileKey: string;
};

export type Hl7v2SubscriberApiResponse = {
  patients: Patient[];
  meta: {
    nextPage?: string;
  };
};
