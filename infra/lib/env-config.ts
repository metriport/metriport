import { EnvType } from "./env-type";

export type ConnectWidgetConfig = {
  stackName: string;
  region: string;
  subdomain: string;
  host: string;
  domain: string;
};

export type EnvConfig = {
  stackName: string;
  secretsStackName: string;
  environmentType: EnvType;
  region: string;
  secretReplicaRegion?: string;
  host: string; // DNS Zone
  domain: string; // Base domain
  subdomain: string; // API subdomain
  authSubdomain: string; // Authentication subdomain
  dbName: string;
  dbUsername: string;
  providerSecretNames: {
    CRONOMETER_CLIENT_ID: string;
    CRONOMETER_CLIENT_SECRET: string;
    FITBIT_CLIENT_ID: string;
    FITBIT_CLIENT_SECRET: string;
    GARMIN_CONSUMER_KEY: string;
    GARMIN_CONSUMER_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    OURA_CLIENT_ID: string;
    OURA_CLIENT_SECRET: string;
    WITHINGS_CLIENT_ID: string;
    WITHINGS_CLIENT_SECRET: string;
    WHOOP_CLIENT_ID: string;
    WHOOP_CLIENT_SECRET: string;
  };
  usageReportUrl?: string;
  fhirServerUrl?: string;
  systemRootOID: string;
  cwOrgName: string;
  cwMemberOid: string;
  cwOrgManagementKey: string;
  cwOrgManagementCertification: string;
  cwOrgMemberKey: string;
  cwOrgMemberCertificate: string;
  gatewayAuthorizationServerEndpoint: string;
  gatewayAuthorizationClientId: string;
  gatewayAuthorizationClientSecret: string;
} & (
  | {
      connectWidget: ConnectWidgetConfig;
      connectWidgetUrl?: never;
    }
  | {
      connectWidget?: never;
      connectWidgetUrl: string;
    }
);
