import { Config as CoreConfig } from "@metriport/core/util/config";
import {
  getEnvVar as coreGetEnvVar,
  getEnvVarOrFail as coreGetEnvVarOrFail,
} from "@metriport/core/util/env-var";

/**
 * @deprecated Use core's version instead
 */
export const getEnvVar = (varName: string): string | undefined => coreGetEnvVar(varName);
/**
 * @deprecated Use core's version instead
 */
export const getEnvVarOrFail = (varName: string): string => coreGetEnvVarOrFail(varName);

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

  static getAWSRegion(): string {
    return getEnvVarOrFail("AWS_REGION");
  }

  static getLbTimeoutInMillis(): number | undefined {
    const timeoutAsString = getEnvVar("LB_TIMEOUT_IN_MILLIS");
    if (timeoutAsString) return parseInt(timeoutAsString);
    return undefined;
  }

  /**
   * @deprecated Use core's Config instead
   */
  static getSlackAlertUrl(): string | undefined {
    return CoreConfig.getSlackAlertUrl();
  }
  /**
   * @deprecated Use core's Config instead
   */
  static getSlackNotificationUrl(): string | undefined {
    return CoreConfig.getSlackNotificationUrl();
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

  /** @deprecated Use core's version of Config instead */
  static getApiUrl(): string {
    return CoreConfig.getApiUrl();
  }

  static getDashUrl(): string | undefined {
    return getEnvVar("DASH_URL");
  }

  static getApiGatewayUsagePlanId(): string | undefined {
    return getEnvVar("API_GW_USAGE_PLAN_ID");
  }

  static getCQManagementApiKey(): string {
    return getEnvVarOrFail("CQ_MANAGEMENT_API_KEY");
  }
  static getCQOrgPrivateKey(): string {
    return getEnvVarOrFail("CQ_ORG_PRIVATE_KEY");
  }
  static getCQOrgPrivateKeyPassword(): string {
    return getEnvVarOrFail("CQ_ORG_PRIVATE_KEY_PASSWORD");
  }
  static getCQOrgCertificate(): string {
    return getEnvVarOrFail("CQ_ORG_CERTIFICATE");
  }

  static getCQOrgUrls(): string | undefined {
    return getEnvVar("CQ_ORG_URLS");
  }
  static getCQUrlsToExclude(): string | undefined {
    return getEnvVar("CQ_URLS_TO_EXCLUDE");
  }
  static getCqAdditionalOrgs(): string | undefined {
    return getEnvVar("CQ_ADDITIONAL_ORGS");
  }

  static getPlaceIndexName(): string {
    return getEnvVarOrFail("PLACE_INDEX_NAME");
  }

  static getPlaceIndexRegion(): string {
    return getEnvVarOrFail("PLACE_INDEX_REGION");
  }

  static getTokenTableName(): string {
    return getEnvVarOrFail("TOKEN_TABLE_NAME");
  }

  static getDBCreds(): string {
    return getEnvVarOrFail("DB_CREDS");
  }

  static getDbPoolSettings(): string | undefined {
    return getEnvVar("DB_POOL_SETTINGS");
  }

  static getDbReadReplicaEndpoint(): string {
    return getEnvVarOrFail("DB_READ_REPLICA_ENDPOINT");
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

  static getFHIRServerUrl(): string {
    return getEnvVarOrFail("FHIR_SERVER_URL");
  }

  static getSystemRootOID(): string {
    return getEnvVarOrFail("SYSTEM_ROOT_OID");
  }

  static getSystemRootOrgName(): string {
    return getEnvVarOrFail("SYSTEM_ROOT_ORG_NAME");
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

  static getCdaToFhirConversionBucketName(): string {
    return getEnvVarOrFail("CONVERSION_RESULT_BUCKET_NAME");
  }
  static getMedicalDocumentsBucketName(): string {
    return getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
  }
  static getMedicalDocumentsUploadBucketName(): string {
    return getEnvVarOrFail("MEDICAL_DOCUMENTS_UPLOADS_BUCKET_NAME");
  }
  static getSandboxSeedBucketName(): string | undefined {
    return getEnvVar("SANDBOX_SEED_DATA_BUCKET_NAME");
  }

  static getFHIRConverterQueueURL(): string | undefined {
    return getEnvVar("FHIR_CONVERTER_QUEUE_URL");
  }
  static getFHIRConverterServerURL(): string | undefined {
    return getEnvVar("FHIR_CONVERTER_SERVER_URL");
  }

  static getConvertDocLambdaName(): string | undefined {
    return getEnvVar("CONVERT_DOC_LAMBDA_NAME");
  }

  static getFhirToCdaConverterLambdaName(): string | undefined {
    return getEnvVar("FHIR_TO_CDA_CONVERTER_LAMBDA_NAME");
  }

  static getDocumentDownloaderLambdaName(): string {
    return getEnvVarOrFail("DOCUMENT_DOWNLOADER_LAMBDA_NAME");
  }

  static getFHIRToMedicalRecordLambdaName(): string | undefined {
    return getEnvVar("FHIR_TO_MEDICAL_RECORD_LAMBDA_NAME");
  }

  static getOutboundPatientDiscoveryLambdaName(): string | undefined {
    return getEnvVar("OUTBOUND_PATIENT_DISCOVERY_LAMBDA_NAME");
  }
  static getOutboundDocumentQueryLambdaName(): string | undefined {
    return getEnvVar("OUTBOUND_DOC_QUERY_LAMBDA_NAME");
  }
  static getOutboundDocumentRetrievalLambdaName(): string | undefined {
    return getEnvVar("OUTBOUND_DOC_RETRIEVAL_LAMBDA_NAME");
  }

  static getPatientImportLambdaName(): string {
    return getEnvVarOrFail("PATIENT_IMPORT_LAMBDA_NAME");
  }

  static getSearchIngestionQueueUrl(): string {
    return getEnvVarOrFail("SEARCH_INGESTION_QUEUE_URL");
  }
  static getSearchEndpoint(): string {
    return getEnvVarOrFail("SEARCH_ENDPOINT");
  }
  static getSearchUsername(): string {
    return getEnvVarOrFail("SEARCH_USERNAME");
  }
  static getSearchPassword(): string {
    return getEnvVarOrFail("SEARCH_PASSWORD");
  }
  static getSearchIndexName(): string {
    return getEnvVarOrFail("SEARCH_INDEX");
  }

  static getCWManagementUrl(): string | undefined {
    return getEnvVar("CW_MANAGEMENT_URL");
  }
  static getCWManagementCookieArn(): string | undefined {
    return getEnvVar("CW_MANAGEMENT_COOKIE_SECRET_ARN");
  }
  static getCWPatientLinkQueueUrl(): string | undefined {
    return getEnvVar("CW_CQ_PATIENT_LINK_QUEUE_URL");
  }

  // app config for feature flags
  static getAppConfigAppId(): string {
    return getEnvVarOrFail("APPCONFIG_APPLICATION_ID");
  }
  static getAppConfigConfigId(): string {
    return getEnvVarOrFail("APPCONFIG_CONFIGURATION_ID");
  }
  static getAppConfigEnvironmentId(): string {
    return getEnvVarOrFail("APPCONFIG_ENVIRONMENT_ID");
  }
  static getAppConfigDeploymentStrategyId(): string {
    return getEnvVarOrFail("APPCONFIG_DEPLOYMENT_STRATEGY_ID");
  }
  static getCQOrgCertificateIntermediate(): string {
    return getEnvVarOrFail("CQ_ORG_CERTIFICATE_INTERMEDIATE");
  }
  static getOrgOidsWithIHEGatewayV2Enabled(): string {
    return getEnvVarOrFail("OIDS_WITH_IHE_GATEWAY_V2_ENABLED");
  }

  static getAthenaHealthEnv(): string | undefined {
    return getEnvVar("EHR_ATHENA_ENVIRONMENT");
  }
  static getAthenaHealthClientKeyArn(): string | undefined {
    return getEnvVar("EHR_ATHENA_CLIENT_KEY_ARN");
  }
  static getAthenaHealthClientSecretArn(): string | undefined {
    return getEnvVar("EHR_ATHENA_CLIENT_SECRET_ARN");
  }
  static getAthenaHealthClientKey(): string | undefined {
    return getEnvVar("EHR_ATHENA_CLIENT_KEY");
  }
  static getAthenaHealthClientSecret(): string | undefined {
    return getEnvVar("EHR_ATHENA_CLIENT_SECRET");
  }

  static getElationEnv(): string | undefined {
    return getEnvVar("EHR_ELATION_ENVIRONMENT");
  }

  static getElationClientKeyAndSecretMap(): string | undefined {
    return getEnvVar("EHR_ELATION_CLIENT_KEY_AND_SECRET_MAP");
  }

  static getRateLimitTableName(): string | undefined {
    return getEnvVar("RATE_LIMIT_TABLE_NAME");
  }
}
