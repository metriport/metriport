import { USState } from "@metriport/shared";
import { Hl7v2Subscriber, Hl7v2Subscription } from "../../domain/patient-settings";

export const hieNames = ["HTX"] as const;
export type HieName = (typeof hieNames)[number];

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

export type HieFieldMapping = {
  id: string;
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
  sftpConfig?: SftpConfig;
  cron?: string;
  schema: HieFieldMapping;
};

export type Hl7v2RosterConfig = {
  hieConfigs: Record<HieName, HieConfig>;
  states: USState[];
  subscriptions: Hl7v2Subscription[];
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
  patients: Hl7v2Subscriber[];
  meta: {
    nextPage?: string;
  };
};
