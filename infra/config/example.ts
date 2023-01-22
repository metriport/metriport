import { EnvConfig } from "../lib/env-config";
import { EnvType } from "../lib/env-type";

export const config: EnvConfig = {
  stackName: "MetriportInfraStack",
  secretsStackName: "MetriportSecretsStack",
  environmentType: EnvType.production,
  region: "us-east-1",
  subdomain: "api",
  host: "myhealthapp.com",
  domain: "myhealthapp.com",
  dbName: "my_db",
  dbUsername: "my_db_user",
  providerSecretNames: {
    CRONOMETER_CLIENT_ID: "CRONOMETER_CLIENT_ID",
    CRONOMETER_CLIENT_SECRET: "CRONOMETER_CLIENT_SECRET",
    FITBIT_CLIENT_ID: "FITBIT_CLIENT_ID",
    FITBIT_CLIENT_SECRET: "FITBIT_CLIENT_SECRET",
    GARMIN_CONSUMER_KEY: "GARMIN_CONSUMER_KEY",
    GARMIN_CONSUMER_SECRET: "GARMIN_CONSUMER_SECRET",
    GOOGLE_CONSUMER_KEY: "GOOGLE_CONSUMER_KEY",
    GOOGLE_CONSUMER_SECRET: "GOOGLE_CONSUMER_SECRET",
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
};
export default config;
