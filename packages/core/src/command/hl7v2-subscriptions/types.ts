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
  genderOtherAsUnknown: string | undefined;
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
  cxShortcode: string | undefined;
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

export type VpnlessHieConfig = Omit<HieConfig, "gatewayPublicIp" | "internalCidrBlock">;

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

/**
 * Type guard to check if config is HieConfig (not VpnlessHieConfig)
 * @param config
 * @returns true if config is HieConfig, false if config is VpnlessHieConfig
 */
export function isHieConfig(config: HieConfig | VpnlessHieConfig): config is HieConfig {
  return "gatewayPublicIp" in config && "internalCidrBlock" in config;
}
