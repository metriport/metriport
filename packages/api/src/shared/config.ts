export const getEnvVar = (varName: string): string | undefined => process.env[varName];

export const getEnvVarOrFail = (varName: string): string => {
  const value = getEnvVar(varName);
  if (!value || value.trim().length < 1) {
    throw new Error(`Missing ${varName} env var`);
  }
  return value;
};

export class Config {
  // env config
  static readonly PROD_ENV = "production";
  static readonly DEV_ENV = "dev";
  static readonly SANDBOX_ENV = "sandbox";
  static readonly STAGING_ENV = "staging";
  static readonly SANDBOX_USER_LIMIT = 10;
  static readonly SANDBOX_PATIENT_LIMIT = 20;

  static isCloudEnv(): boolean {
    return process.env.NODE_ENV === this.PROD_ENV;
  }
  static getEnvType(): string {
    return getEnvVarOrFail("ENV_TYPE");
  }
  static isProdEnv(): boolean {
    return Config.getEnvType() === this.PROD_ENV;
  }
  static isSandbox(): boolean {
    return Config.getEnvType() === this.SANDBOX_ENV;
  }
  static isStaging(): boolean {
    return Config.getEnvType() === this.STAGING_ENV;
  }
  static isDev(): boolean {
    return Config.getEnvType() === this.DEV_ENV;
  }

  static getVersion(): string | undefined {
    return getEnvVar("METRIPORT_VERSION");
  }

  static getAWSRegion(): string | undefined {
    return getEnvVar("AWS_REGION");
  }

  static getSlackAlertUrl(): string | undefined {
    return getEnvVar("SLACK_ALERT_URL");
  }
  static getSlackNotificationUrl(): string | undefined {
    return getEnvVar("SLACK_NOTIFICATION_URL");
  }

  static getSentryDSN(): string | undefined {
    return getEnvVar("SENTRY_DSN");
  }

  static getConnectWidgetUrl(): string {
    return getEnvVarOrFail("CONNECT_WIDGET_URL");
  }

  static getConnectRedirectUrl(): string {
    if (this.isCloudEnv()) {
      return `${Config.getApiUrl()}/token/connect`;
    }

    // Garmin requires an internet accessible address - use a proxy like NGrok or similar
    return `${Config.getApiUrl()}/connect`;
  }

  static getApiUrl(): string {
    return getEnvVarOrFail("API_URL");
  }

  static getTokenTableName(): string {
    return getEnvVarOrFail("TOKEN_TABLE_NAME");
  }

  static getDBCreds(): string {
    return getEnvVarOrFail("DB_CREDS");
  }

  static getCronometerClientId(): string {
    return getEnvVarOrFail("CRONOMETER_CLIENT_ID");
  }
  static getCronometerClientSecret(): string {
    return getEnvVarOrFail("CRONOMETER_CLIENT_SECRET");
  }

  static getGarminConsumerKey(): string {
    return getEnvVarOrFail("GARMIN_CONSUMER_KEY");
  }
  static getGarminConsumerSecret(): string {
    return getEnvVarOrFail("GARMIN_CONSUMER_SECRET");
  }

  static getOuraClientId(): string {
    return getEnvVarOrFail("OURA_CLIENT_ID");
  }
  static getOuraClientSecret(): string {
    return getEnvVarOrFail("OURA_CLIENT_SECRET");
  }

  static getDexcomClientId(): string {
    return getEnvVarOrFail("DEXCOM_CLIENT_ID");
  }
  static getDexcomClientSecret(): string {
    return getEnvVarOrFail("DEXCOM_CLIENT_SECRET");
  }

  static getFitbitClientId(): string {
    return getEnvVarOrFail("FITBIT_CLIENT_ID");
  }
  static getFitbitClientSecret(): string {
    return getEnvVarOrFail("FITBIT_CLIENT_SECRET");
  }

  static getGoogleClientId(): string {
    return getEnvVarOrFail("GOOGLE_CLIENT_ID");
  }
  static getGoogleClientSecret(): string {
    return getEnvVarOrFail("GOOGLE_CLIENT_SECRET");
  }

  static getWhoopClientId(): string {
    return getEnvVarOrFail("WHOOP_CLIENT_ID");
  }
  static getWhoopClientSecret(): string {
    return getEnvVarOrFail("WHOOP_CLIENT_SECRET");
  }

  static getWithingsClientId(): string {
    return getEnvVarOrFail("WITHINGS_CLIENT_ID");
  }
  static getWithingsClientSecret(): string {
    return getEnvVarOrFail("WITHINGS_CLIENT_SECRET");
  }

  static getUsageUrl(): string | undefined {
    return getEnvVar("USAGE_URL");
  }

  static getFHIRServerUrl(): string | undefined {
    return getEnvVar("FHIR_SERVER_URL");
  }
  static getFHIRServerUrlOrFail(): string {
    const url = Config.getFHIRServerUrl();
    if (!url) throw new Error(`Missing FHIR_SERVER_URL env var, env: ${Config.getEnvType()}`);
    return url;
  }

  static getFHIRServerQueueURL(): string {
    return getEnvVarOrFail("FHIR_SERVER_QUEUE_URL");
  }

  static getSystemRootOID(): string {
    return getEnvVarOrFail("SYSTEM_ROOT_OID");
  }

  static getGatewayEndpoint(): string {
    return getEnvVarOrFail("CW_GATEWAY_ENDPOINT");
  }

  static getGatewayAuthorizationServerEndpoint(): string {
    return getEnvVarOrFail("CW_GATEWAY_AUTHORIZATION_SERVER_ENDPOINT");
  }

  static getGatewayAuthorizationClientId(): string {
    return getEnvVarOrFail("CW_GATEWAY_AUTHORIZATION_CLIENT_ID");
  }

  static getGatewayAuthorizationClientSecret(): string {
    return getEnvVarOrFail("CW_GATEWAY_AUTHORIZATION_CLIENT_SECRET");
  }

  static getCWOrgPrivateKey(): string {
    return getEnvVarOrFail("CW_ORG_PRIVATE_KEY");
  }
  static getCWOrgCertificate(): string {
    return getEnvVarOrFail("CW_ORG_CERTIFICATE");
  }

  static getCWMemberPrivateKey(): string {
    return getEnvVarOrFail("CW_MEMBER_PRIVATE_KEY");
  }
  static getCWMemberCertificate(): string {
    return getEnvVarOrFail("CW_MEMBER_CERTIFICATE");
  }

  static getCWMemberOrgName(): string {
    return getEnvVarOrFail("CW_MEMBER_NAME");
  }
  static getCWMemberOID(): string {
    return getEnvVarOrFail("CW_MEMBER_OID");
  }

  static getPostHogApiKey(): string | undefined {
    return getEnvVar("POST_HOG_API_KEY");
  }

  static getTestApiKey(): string | undefined {
    return getEnvVar("TEST_API_KEY");
  }

  static getMedicalDocumentsBucketName(): string {
    return getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
  }
  static getSandboxBucketName(): string | undefined {
    return getEnvVar("SANDBOX_SEED_DATA_BUCKET_NAME");
  }

  static getFHIRConverterQueueURL(): string | undefined {
    return getEnvVar("FHIR_CONVERTER_QUEUE_URL");
  }
  static getFHIRConverterServerURL(): string | undefined {
    return getEnvVar("FHIR_CONVERTER_SERVER_URL");
  }

  static getSidechainFHIRConverterQueueURL(): string | undefined {
    return getEnvVar("SIDECHAIN_FHIR_CONVERTER_QUEUE_URL");
  }

  static getConvertDocLambdaName(): string | undefined {
    return getEnvVar("CONVERT_DOC_LAMBDA_NAME");
  }

  static getDocumentDownloaderLambdaName(): string {
    return getEnvVarOrFail("DOCUMENT_DOWNLOADER_LAMBDA_NAME");
  }

  static getSearchIngestionQueueUrl(): string {
    return getEnvVarOrFail("SEARCH_INGESTION_QUEUE_URL");
  }
  static getSearchEndpoint(): string | undefined {
    return getEnvVar("SEARCH_ENDPOINT");
  }
  static getSearchPassword(): string | undefined {
    return getEnvVar("SEARCH_PASSWORD");
  }
}
