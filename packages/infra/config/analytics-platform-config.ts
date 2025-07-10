export interface AnalyticsPlatformConfig {
  bucketName: string;
  secrets: {
    SNOWFLAKE_CREDS: string;
  };
  snowflake: {
    integrationUserArn: string;
    integrationExternalId: string;
  };
}
