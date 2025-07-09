export interface AnalyticsPlatformConfig {
  bucketName: string;
  secrets: {
    SNOWFLAKE_CREDS: string;
  };
  snowflake: {
    warehouse: string;
    role: string;
    integration: string;
  };
}
