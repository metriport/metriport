import { RDSConfigExtended } from "./aws/rds";

export interface AnalyticsPlatformConfig {
  bucketName: string;
  secretNames: {
    /** Snowflake credentials for all regions we support */
    SNOWFLAKE_CREDS: string;
    /** Optional custom database names for each customer - if not provided, the default database name will be used */
    SNOWFLAKE_CUSTOM_CX_SETTINGS: string;
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
