import { RDSConfigExtended } from "./aws/rds";

export const secretEnvVarNames = ["FHIR_TO_CSV_DB_PASSWORD", "RAW_TO_CORE_DB_PASSWORD"] as const;
export type SecretEnvVarNames = (typeof secretEnvVarNames)[number];

export interface AnalyticsPlatformConfig {
  bucketName: string;
  secretNames: Record<SecretEnvVarNames, string> & {
    /** @deprecated Use the other snowflake creds secret instead. */
    SNOWFLAKE_CREDS: string; // TODO eng-954 remove this
    /** Snowflake credentials for all regions we support. @see `packages/core/src/external/snowflake/creds.ts` */
    SNOWFLAKE_CREDS_FOR_ALL_REGIONS: string;
    /** Customer specific database config. @see `packages/core/src/external/snowflake/creds.ts` */
    SNOWFLAKE_SETTINGS_FOR_ALL_CXS: string;
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
