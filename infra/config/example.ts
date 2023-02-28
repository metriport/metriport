import { EnvConfig } from "../lib/env-config";
import { EnvType } from "../lib/env-type";

export const config: EnvConfig = {
  stackName: "MetriportInfraStack",
  secretsStackName: "MetriportSecretsStack",
  environmentType: EnvType.production,
  region: "us-east-1",
  host: "myhealthapp.com",
  domain: "myhealthapp.com",
  subdomain: "api",
  authSubdomain: "auth",
  dbName: "my_db",
  dbUsername: "my_db_user",
  providerSecretNames: {
    CRONOMETER_CLIENT_ID: "CRONOMETER_CLIENT_ID",
    CRONOMETER_CLIENT_SECRET: "CRONOMETER_CLIENT_SECRET",
    FITBIT_CLIENT_ID: "FITBIT_CLIENT_ID",
    FITBIT_CLIENT_SECRET: "FITBIT_CLIENT_SECRET",
    GARMIN_CONSUMER_KEY: "GARMIN_CONSUMER_KEY",
    GARMIN_CONSUMER_SECRET: "GARMIN_CONSUMER_SECRET",
    GOOGLE_CLIENT_ID: "GOOGLE_CLIENT_ID",
    GOOGLE_CLIENT_SECRET: "GOOGLE_CLIENT_SECRET",
    OURA_CLIENT_ID: "OURA_CLIENT_ID",
    OURA_CLIENT_SECRET: "OURA_CLIENT_SECRET",
    WITHINGS_CLIENT_ID: "WITHINGS_CLIENT_ID",
    WITHINGS_CLIENT_SECRET: "WITHINGS_CLIENT_SECRET",
    WHOOP_CLIENT_ID: "WHOOP_CLIENT_ID",
    WHOOP_CLIENT_SECRET: "WHOOP_CLIENT_SECRET",
  },
  connectWidget: {
    stackName: "MetriportConnectInfraStack",
    region: "us-east-1",
    subdomain: "connect",
    domain: "myhealthapp.com",
    host: "myhealthapp.com",
  },
  systemRootOID: "2.16.840.1.113883.3.999999",
};
export default config;
