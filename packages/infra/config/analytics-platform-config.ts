import { RDSConfigExtended } from "./aws/rds";

export interface AnalyticsPlatformConfig {
  bucketName: string;
  secretNames: {
    SNOWFLAKE_CREDS: string;
    FHIR_TO_CSV_DB_PASSWORD: string;
    RAW_TO_CORE_DB_PASSWORD: string;
  };
  snowflake: {
    warehouse: string;
    role: string;
    integrationName: string;
    integrationUserArn: string;
    integrationExternalId: string;
  };
  rds: RDSConfigExtended & {
    fhirToCsvDbUsername: string;
    rawToCoreDbUsername: string;
  };
}
