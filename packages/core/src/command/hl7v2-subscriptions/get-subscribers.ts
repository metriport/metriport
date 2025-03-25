import { USState } from "@metriport/shared";
import { Hl7v2Subscriber, Hl7v2Subscription } from "../../domain/patient-settings";

export type SftpConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  remotePath: string;
};

export type HieConfig = {
  name: string;
  sftpConfig: SftpConfig;
  schema: Record<string, string>;
};

export type Hl7v2RosterConfig = {
  apiUrl: string;
  states: USState[];
  subscriptions: Hl7v2Subscription[];
  hieConfig: HieConfig;
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
