import { USState } from "@metriport/shared";
import { Patient } from "../../domain/patient";
import { Hl7v2Subscription } from "../../domain/patient-settings";
import { HieIanaTimezone } from "../../external/hl7-notification/hie-config-dictionary";

export type SftpConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  remotePath: string;
};

export type RosterRowData = {
  id: string;
  cxId: string;
  rosterGenerationDate: string;
  firstName: string;
  lastName: string;
  dob: string;
  dobNoDelimiter: string;
  middleName: string | undefined;
  genderAtBirth: string | undefined;
  scrambledId: string;
  ssn: string | undefined;
  driversLicense: string | undefined;
  phone: string | undefined;
  email: string | undefined;
  address1AddressLine1: string | undefined;
  address1AddressLine2: string | undefined;
  address1SingleLine: string | undefined;
  address1City: string | undefined;
  address1State: string | undefined;
  address1Zip: string | undefined;
  insuranceId: string | undefined;
  insuranceCompanyId: string | undefined;
  insuranceCompanyName: string | undefined;
  authorizingParticipantFacilityCode: string | undefined;
  authorizingParticipantMrn: string | undefined;
  assigningAuthorityIdentifier: string | undefined;
  lineOfBusiness: string;
  emptyString: string;
};

export type HiePatientRosterMapping = {
  [key: string]: keyof RosterRowData;
};

export type HieConfig = {
  name: string;
  gatewayPublicIp: string;
  internalCidrBlock: string;
  timezone: HieIanaTimezone;
  states: USState[];
  subscriptions: Hl7v2Subscription[];
  cron: string;
  sftpConfig?: SftpConfig;
  mapping: HiePatientRosterMapping;
};

export type Hl7v2SubscriberParams = {
  hie: string;
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
