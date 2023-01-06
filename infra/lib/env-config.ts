import { EnvType } from "./env-type";

export interface EnvConfig {
  stackName: string;
  secretsStackName?: string;
  environmentType: EnvType;
  region: string;
  secretReplicaRegion?: string;
  subdomain: string;
  host: string;
  domain: string;
  dbName: string;
  dbUsername: string;
  providerSecretNames: {
    CRONOMETER_CLIENT_ID: string;
    CRONOMETER_CLIENT_SECRET: string;
    FITBIT_CLIENT_ID: string;
    FITBIT_CLIENT_SECRET: string;
    GARMIN_CONSUMER_KEY: string;
    GARMIN_CONSUMER_SECRET: string;
    OURA_CLIENT_ID: string;
    OURA_CLIENT_SECRET: string;
    WITHINGS_CLIENT_ID: string;
    WITHINGS_CLIENT_SECRET: string;
    WHOOP_CLIENT_ID: string;
    WHOOP_CLIENT_SECRET: string;
  };
  connectWidget?: {
    stackName: string;
    region: string;
    subdomain: string;
    host: string;
    domain: string;
  };
  connectWidgetUrl?: string;
  usageReportUrl?: string;
}
