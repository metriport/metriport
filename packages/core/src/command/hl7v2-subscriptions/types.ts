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

export type MetriportToHieFieldMapping = {
  rosterGenerationDate?: string;
  scrambledId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dob: string;
  genderAtBirth: string;
  ssn?: string;
  phone?: string;
  email?: string;
  driversLicense?: string;
  address1AddressLine1?: string;
  address1AddressLine2?: string;
  address1City?: string;
  address1State?: string;
  address1Zip?: string;
  insuranceId?: string;
  insuranceCompanyId?: string;
  insuranceCompanyName?: string;
  assigningAuthorityIdentifier?: string;
  authorizingParticipantFacilityCode?: string;
  authorizingParticipantMrn?: string;
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
