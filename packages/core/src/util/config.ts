import { getEnvVar, getEnvVarOrFail } from "./env-var";

/**
 * Shared configs, still defining how to work with this. For now:
 * - keep each config either here or on API
 * - move as needed, consider whether this config is available on the
 *   environment where core is being used
 */
export class Config {
  static readonly PROD_ENV = "production";
  static readonly DEV_ENV = "dev";
  static readonly SANDBOX_ENV = "sandbox";
  static readonly STAGING_ENV = "staging";

  static isCloudEnv(): boolean {
    return process.env.NODE_ENV === this.PROD_ENV;
  }

  static isSandbox(): boolean {
    return Config.getEnvType() === this.SANDBOX_ENV;
  }

  static isDev(): boolean {
    return Config.getEnvType() === this.DEV_ENV;
  }

  static isStaging(): boolean {
    return Config.getEnvType() === this.STAGING_ENV;
  }

  static getEnvType(): string {
    return getEnvVarOrFail("ENV_TYPE");
  }

  static getSlackAlertUrl(): string | undefined {
    return getEnvVar("SLACK_ALERT_URL");
  }
  static getSlackNotificationUrl(): string | undefined {
    return getEnvVar("SLACK_NOTIFICATION_URL");
  }
  static getSlackSensitiveDataChannelUrl(): string | undefined {
    return getEnvVar("SLACK_SENSITIVE_DATA_URL");
  }

  static getAWSRegion(): string {
    return getEnvVarOrFail("AWS_REGION");
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
  static getSearchIngestionQueueUrl(): string {
    return getEnvVarOrFail("SEARCH_INGESTION_QUEUE_URL");
  }
  static getSystemRootOID(): string {
    return getEnvVarOrFail("SYSTEM_ROOT_OID");
  }

  static getFHIRServerUrl(): string {
    return getEnvVarOrFail("FHIR_SERVER_URL");
  }

  static getMedicalDocumentsBucketName(): string {
    return getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
  }
  static getCdaToFhirConversionBucketName(): string | undefined {
    return getEnvVar("CONVERSION_RESULT_BUCKET_NAME");
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
  static getCQOrgCertificateIntermediate(): string {
    return getEnvVarOrFail("CQ_ORG_CERTIFICATE_INTERMEDIATE");
  }

  static getCqTrustBundleBucketName(): string {
    return getEnvVarOrFail("CQ_TRUST_BUNDLE_BUCKET_NAME");
  }
  static getApiUrl(): string {
    return getEnvVarOrFail("API_URL");
  }
  static getApiLoadBalancerAddress(): string {
    return getEnvVarOrFail("API_LB_ADDRESS");
  }

  static getPostHogApiKey(): string | undefined {
    return getEnvVar("POST_HOG_API_KEY_SECRET");
  }

  static getIheResponsesBucketName(): string | undefined {
    return getEnvVar("IHE_RESPONSES_BUCKET_NAME");
  }

  static getIheRequestsBucketName(): string | undefined {
    return getEnvVar("IHE_REQUESTS_BUCKET_NAME");
  }

  static getIheParsedResponsesBucketName(): string | undefined {
    return getEnvVar("IHE_PARSED_RESPONSES_BUCKET_NAME");
  }

  static getFHIRtoBundleLambdaName(): string {
    return getEnvVarOrFail("FHIR_TO_BUNDLE_LAMBDA_NAME");
  }

  static getBedrockRegion(): string | undefined {
    return getEnvVar("BEDROCK_REGION");
  }

  static getBedrockVersion(): string | undefined {
    return getEnvVar("BEDROCK_VERSION");
  }

  static getAiBriefModelId(): string | undefined {
    return getEnvVar("AI_BRIEF_MODEL_ID");
  }
  static getAppConfigAppId(): string {
    return getEnvVarOrFail("APPCONFIG_APPLICATION_ID");
  }
  static getAppConfigConfigId(): string {
    return getEnvVarOrFail("APPCONFIG_CONFIGURATION_ID");
  }

  static getEhrResponsesBucketName(): string | undefined {
    return getEnvVar("EHR_RESPONSES_BUCKET_NAME");
  }

  static getPatientImportBucket(): string | undefined {
    return getEnvVar("PATIENT_IMPORT_BUCKET_NAME");
  }
}
