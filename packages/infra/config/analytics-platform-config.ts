import { RDSConfigExtended } from "./aws/rds";

export interface AnalyticsPlatformConfig {
  bucketName: string;
  secretNames: {
    /** Snowflake credentials for all regions we support. @see `packages/core/src/external/snowflake/creds.ts` */
    SNOWFLAKE_CREDS_FOR_ALL_REGIONS: string;
    /** Customer specific database config. @see `packages/core/src/external/snowflake/creds.ts` */
    SNOWFLAKE_SETTINGS_FOR_ALL_CXS: string;
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
