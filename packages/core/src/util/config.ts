import { MetriportError } from "@metriport/shared";
import { getEnvVarAsRecordOrFail } from "@metriport/shared/common/env-var";
import { DbCreds, dbCredsSchema } from "@metriport/shared/domain/db";
import { ROSTER_UPLOAD_SFTP_PASSWORD } from "@metriport/shared/domain/tcm-encounter";
import type { BedrockRegion } from "../external/bedrock/client";
import { SftpConfig } from "../external/sftp/types";
import {
  SnowflakeCreds,
  snowflakeCredsSchema,
  SnowflakeSettingsForAllCxs,
  snowflakeSettingsForAllCxsSchema,
} from "../external/snowflake/creds";
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
    return process.env["NODE_ENV"] === this.PROD_ENV;
  }

  static isProduction(): boolean {
    return Config.getEnvType() === this.PROD_ENV;
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

  static getGeneralBucketName(): string {
    return getEnvVarOrFail("GENERAL_BUCKET_NAME");
  }
  static getAuditLogsBucketName(): string {
    return getEnvVarOrFail("AUDIT_LOGS_BUCKET_NAME");
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

  static getConsolidatedSearchIndexName(): string {
    return getEnvVarOrFail("CONSOLIDATED_SEARCH_INDEX");
  }
  static getConsolidatedSearchLambdaName(): string {
    return getEnvVarOrFail("CONSOLIDATED_SEARCH_LAMBDA_NAME");
  }
  static getConsolidatedIngestionQueueUrl(): string {
    return getEnvVarOrFail("CONSOLIDATED_INGESTION_QUEUE_URL");
  }
  static getConsolidatedDataIngestionInitialDate(): string | undefined {
    return getEnvVar("CONSOLIDATED_INGESTION_INITIAL_DATE");
  }

  static getSystemRootOID(): string {
    return getEnvVarOrFail("SYSTEM_ROOT_OID");
  }
  static getHl7Base64ScramblerSeed(): string {
    return getEnvVarOrFail("HL7_BASE64_SCRAMBLER_SEED");
  }

  static getHl7Base64ScramblerSeedArn(): string {
    return getEnvVarOrFail("HL7_BASE64_SCRAMBLER_SEED_ARN");
  }

  static getFHIRServerUrl(): string {
    return getEnvVarOrFail("FHIR_SERVER_URL");
  }

  static getMedicalDocumentsBucketName(): string {
    return getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
  }
  static getHl7IncomingMessageBucketName(): string {
    return getEnvVarOrFail("HL7_INCOMING_MESSAGE_BUCKET_NAME");
  }
  static getHl7RawMessageBucketName(): string {
    return getEnvVarOrFail("HL7_RAW_MESSAGE_BUCKET_NAME");
  }
  static getHl7OutgoingMessageBucketName(): string {
    return getEnvVarOrFail("HL7_OUTGOING_MESSAGE_BUCKET_NAME");
  }
  static getHl7ConversionBucketName(): string | undefined {
    return getEnvVar("HL7_CONVERSION_BUCKET_NAME");
  }
  static getHl7NotificationQueueUrl(): string {
    return getEnvVarOrFail("HL7_NOTIFICATION_QUEUE_URL");
  }
  static getHieConfigDictionary(): Record<string, unknown> {
    if (Config.isSandbox()) {
      return { SandboxTestHie: { timezone: "America/New_York" } };
    }
    return getEnvVarAsRecordOrFail("HIE_CONFIG_DICTIONARY");
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
  static getEhexTrustBundleBucketName(): string {
    return getEnvVarOrFail("EHEX_TRUST_BUNDLE_BUCKET_NAME");
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

  static getEhexOutboundBucketName(): string | undefined {
    return getEnvVar("EHEX_RESPONSES_BUCKET_NAME");
  }

  static getEhexInboundBucketName(): string | undefined {
    return getEnvVar("EHEX_REQUESTS_BUCKET_NAME");
  }

  static getEhexParsedResponsesBucketName(): string | undefined {
    return getEnvVar("EHEX_PARSED_RESPONSES_BUCKET_NAME");
  }

  // TODO ENG-1601 Duplicate of Config.getEhexOrgUrls() on packages/api, keep this one here.
  static getEhexServiceOwnUrls(): string | undefined {
    return getEnvVar("EHEX_SERVICE_OWN_URLS");
  }

  static getEhexOrgPrivateKey(): string {
    return getEnvVarOrFail("EHEX_ORG_PRIVATE_KEY");
  }
  static getEhexOrgPrivateKeyPassword(): string {
    return getEnvVarOrFail("EHEX_ORG_PRIVATE_KEY_PASSWORD");
  }
  static getEhexOrgCertificate(): string {
    return getEnvVarOrFail("EHEX_ORG_CERTIFICATE");
  }
  static getEhexOrgCertificateIntermediate(): string {
    return getEnvVarOrFail("EHEX_ORG_CERTIFICATE_INTERMEDIATE");
  }

  static getFHIRtoBundleLambdaName(): string {
    return getEnvVarOrFail("FHIR_TO_BUNDLE_LAMBDA_NAME");
  }
  static getFHIRtoBundleCountLambdaName(): string {
    return getEnvVarOrFail("FHIR_TO_BUNDLE_COUNT_LAMBDA_NAME");
  }

  static getBedrockRegion(): BedrockRegion {
    return (getEnvVar("BEDROCK_REGION") ?? "us-east-1") as BedrockRegion;
  }

  static getBedrockVersion(): string | undefined {
    return getEnvVar("BEDROCK_VERSION");
  }

  static getBedrockApiKeySecretName(): string | undefined {
    return getEnvVar("BEDROCK_API_KEY_SECRET");
  }

  static getBedrockApiKey(): string | undefined {
    return getEnvVar("BEDROCK_API_KEY");
  }

  static getBedrockBaseUrl(): string {
    return getEnvVarOrFail("BEDROCK_BASE_URL");
  }

  static getComprehendRegion(): string {
    return getEnvVar("COMPREHEND_REGION") ?? Config.getAWSRegion();
  }

  static getBasetenApiKeySecretName(): string | undefined {
    return getEnvVar("BASETEN_API_KEY_SECRET");
  }

  static getBasetenApiKey(): string | undefined {
    return getEnvVar("BASETEN_API_KEY");
  }

  static getBasetenBaseUrl(): string {
    return getEnvVarOrFail("BASETEN_BASE_URL");
  }

  static getAiBriefModelId(): string | undefined {
    return getEnvVar("AI_BRIEF_MODEL_ID");
  }

  static getFeatureFlagsTableName(): string {
    return getEnvVarOrFail("FEATURE_FLAGS_TABLE_NAME");
  }

  static getPatientStateTableName(): string {
    return getEnvVarOrFail("PATIENT_STATE_TABLE_NAME");
  }

  static getEhrResponsesBucketName(): string | undefined {
    return getEnvVar("EHR_RESPONSES_BUCKET_NAME");
  }

  static getPatientImportBucket(): string {
    return getEnvVarOrFail("PATIENT_IMPORT_BUCKET_NAME");
  }
  static getPatientImportParseLambdaName(): string {
    return getEnvVarOrFail("PATIENT_IMPORT_PARSE_LAMBDA_NAME");
  }
  static getPatientImportCreateQueueUrl(): string {
    return getEnvVarOrFail("PATIENT_IMPORT_CREATE_QUEUE_URL");
  }
  static getPatientImportQueryQueueUrl(): string {
    return getEnvVarOrFail("PATIENT_IMPORT_QUERY_QUEUE_URL");
  }
  static getPatientImportResultLambdaName(): string {
    return getEnvVarOrFail("PATIENT_IMPORT_RESULT_LAMBDA_NAME");
  }
  static getPatientMonitoringScheduledQueriesQueueUrl(): string {
    return getEnvVarOrFail("PATIENT_MONITORING_SCHEDULED_QUERIES_QUEUE_URL");
  }

  static getDocumentQueryQueueUrl(): string {
    return getEnvVarOrFail("DOCUMENT_QUERY_QUEUE_URL");
  }

  static getWaitTimeInMillis(): number {
    const fallbackWaitTime = 5000;
    const waitTimeRaw = getEnvVar("WAIT_TIME_IN_MILLIS");
    const waitTime = waitTimeRaw ? parseInt(waitTimeRaw) : fallbackWaitTime;
    return Number.isNaN(waitTime) ? fallbackWaitTime : waitTime;
  }

  static getDischargeRequeryQueueUrl(): string {
    return getEnvVarOrFail("DISCHARGE_REQUERY_QUEUE_URL");
  }

  static getEhrSyncPatientQueueUrl(): string {
    return getEnvVarOrFail("EHR_SYNC_PATIENT_QUEUE_URL");
  }
  static getElationLinkPatientQueueUrl(): string {
    return getEnvVarOrFail("ELATION_LINK_PATIENT_QUEUE_URL");
  }
  static getHealthieLinkPatientQueueUrl(): string {
    return getEnvVarOrFail("HEALTHIE_LINK_PATIENT_QUEUE_URL");
  }
  static getEhrStartResourceDiffBundlesQueueUrl(): string {
    return getEnvVarOrFail("EHR_START_RESOURCE_DIFF_BUNDLES_QUEUE_URL");
  }
  static getEhrComputeResourceDiffBundlesQueueUrl(): string {
    return getEnvVarOrFail("EHR_COMPUTE_RESOURCE_DIFF_BUNDLES_QUEUE_URL");
  }
  static getEhrRefreshEhrBundlesQueueUrl(): string {
    return getEnvVarOrFail("EHR_REFRESH_EHR_BUNDLES_QUEUE_URL");
  }
  static getEhrContributeDiffBundlesQueueUrl(): string {
    return getEnvVarOrFail("EHR_CONTRIBUTE_RESOURCE_DIFF_BUNDLES_QUEUE_URL");
  }
  static getEhrWriteBackDiffBundlesQueueUrl(): string {
    return getEnvVarOrFail("EHR_WRITE_BACK_RESOURCE_DIFF_BUNDLES_QUEUE_URL");
  }
  static getEhrBundleBucketName(): string {
    return getEnvVarOrFail("EHR_BUNDLE_BUCKET_NAME");
  }
  static getEhrGetAppointmentsLambdaName(): string {
    return getEnvVarOrFail("EHR_GET_APPOINTMENTS_LAMBDA_NAME");
  }

  static getTermServerUrl(): string | undefined {
    return getEnvVar("TERM_SERVER_URL");
  }
  static getWriteToS3QueueUrl(): string {
    return getEnvVarOrFail("WRITE_TO_S3_QUEUE_URL");
  }

  static getSftpActionLambda(): boolean {
    return getEnvVar("SFTP_ACTION_LAMBDA") != undefined;
  }

  static isDebugModeEnabled(): boolean {
    return getEnvVar("DEBUG_MODE_ENABLED") === "true";
  }

  static getSurescriptsHost(): string {
    return getEnvVarOrFail("SURESCRIPTS_SFTP_HOST");
  }
  static getSurescriptsPort(): number {
    const port = Number.parseInt(getEnvVarOrFail("SURESCRIPTS_SFTP_PORT"));
    if (isFinite(port)) {
      return port;
    }
    throw new Error("SURESCRIPTS_SFTP_PORT is not a valid number");
  }
  static getSurescriptsSftpSenderId(): string {
    return getEnvVarOrFail("SURESCRIPTS_SFTP_SENDER_ID");
  }
  static getSurescriptsSftpSenderPassword(): string {
    return getEnvVarOrFail("SURESCRIPTS_SFTP_SENDER_PASSWORD");
  }
  static getSurescriptsSftpReceiverId(): string {
    return getEnvVarOrFail("SURESCRIPTS_SFTP_RECEIVER_ID");
  }
  static getSurescriptsSftpPublicKey(): string {
    return getEnvVarOrFail("SURESCRIPTS_SFTP_PUBLIC_KEY");
  }
  static getSurescriptsSftpPrivateKey(): string {
    return getEnvVarOrFail("SURESCRIPTS_SFTP_PRIVATE_KEY");
  }
  static getSurescriptsSftpActionLambdaName(): string {
    return getEnvVarOrFail("SURESCRIPTS_SFTP_ACTION_LAMBDA_NAME");
  }
  static getSurescriptsUploadRosterLambdaName(): string {
    return getEnvVarOrFail("SURESCRIPTS_UPLOAD_ROSTER_LAMBDA_NAME");
  }
  static getSurescriptsIngestAllResponsesLambdaName(): string {
    return getEnvVarOrFail("SURESCRIPTS_INGEST_ALL_RESPONSES_LAMBDA_NAME");
  }
  static getSurescriptsConvertBatchResponseQueueUrl(): string {
    return getEnvVarOrFail("SURESCRIPTS_CONVERT_BATCH_RESPONSE_QUEUE_URL");
  }
  static getSurescriptsConvertPatientResponseQueueUrl(): string {
    return getEnvVarOrFail("SURESCRIPTS_CONVERT_PATIENT_RESPONSE_QUEUE_URL");
  }
  static getSurescriptsReplicaBucketName(): string {
    return getEnvVarOrFail("SURESCRIPTS_REPLICA_BUCKET_NAME");
  }
  static getPharmacyConversionBucketName(): string | undefined {
    return getEnvVar("PHARMACY_CONVERSION_BUCKET_NAME");
  }

  static getQuestSftpHost(): string {
    return getEnvVarOrFail("QUEST_SFTP_HOST");
  }
  static getQuestSftpPort(): number {
    const port = Number.parseInt(getEnvVarOrFail("QUEST_SFTP_PORT"));
    if (isFinite(port)) {
      return port;
    }
    throw new Error("QUEST_SFTP_PORT is not a valid number");
  }
  static getQuestSftpUsername(): string {
    return getEnvVarOrFail("QUEST_SFTP_USERNAME");
  }
  static getQuestSftpPassword(): string {
    return getEnvVarOrFail("QUEST_SFTP_PASSWORD");
  }
  static getQuestSftpOutgoingDirectory(): string {
    return getEnvVarOrFail("QUEST_OUTGOING_DIRECTORY_PATH");
  }
  static getQuestSftpIncomingDirectory(): string {
    return getEnvVarOrFail("QUEST_INCOMING_DIRECTORY_PATH");
  }
  static getQuestSftpActionLambdaName(): string {
    return getEnvVarOrFail("QUEST_SFTP_ACTION_LAMBDA_NAME");
  }
  static getQuestUploadRosterLambdaName(): string {
    return getEnvVarOrFail("QUEST_UPLOAD_ROSTER_LAMBDA_NAME");
  }
  static getQuestIngestAllResponsesLambdaName(): string {
    return getEnvVarOrFail("QUEST_INGEST_ALL_RESPONSES_LAMBDA_NAME");
  }
  static getQuestConvertPatientResponseQueueUrl(): string {
    return getEnvVarOrFail("QUEST_CONVERT_PATIENT_RESPONSE_QUEUE_URL");
  }
  static getQuestReplicaBucketName(): string | undefined {
    return getEnvVar("QUEST_REPLICA_BUCKET_NAME");
  }
  static getLabConversionBucketName(): string | undefined {
    return getEnvVar("LAB_CONVERSION_BUCKET_NAME");
  }

  static getStructuredDataBucketName(): string | undefined {
    return getEnvVar("STRUCTURED_DATA_BUCKET_NAME");
  }

  static getAthenaHealthEnv(): string | undefined {
    return getEnvVar("EHR_ATHENA_ENVIRONMENT");
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

  static getCanvasClientKeyAndSecretMap(): string | undefined {
    return getEnvVar("EHR_CANVAS_CLIENT_KEY_AND_SECRET_MAP");
  }

  static getHealthieEnv(): string | undefined {
    return getEnvVar("EHR_HEALTHIE_ENVIRONMENT");
  }
  static getHealthieApiKeyMap(): string | undefined {
    return getEnvVar("EHR_HEALTHIE_API_KEY_MAP");
  }

  static getEClinicalWorksEnv(): string | undefined {
    return getEnvVar("EHR_ECLINICALWORKS_ENVIRONMENT");
  }

  static getSalesforceEnv(): string | undefined {
    return getEnvVar("EHR_SALESFORCE_ENVIRONMENT");
  }

  static getPracticeFusionEnv(): string | undefined {
    return getEnvVar("EHR_PRACTICEFUSION_ENVIRONMENT");
  }

  static getPracticeFusionClientKeySecretMap(): string | undefined {
    return getEnvVar("PRACTICEFUSION_CLIENT_KEY_AND_SECRET_MAP");
  }

  static getRunPatientJobQueueUrl(): string {
    return getEnvVarOrFail("RUN_PATIENT_JOB_QUEUE_URL");
  }

  static getFhirConverterLambdaName(): string {
    return getEnvVarOrFail("FHIR_CONVERTER_LAMBDA_NAME");
  }
  static getFhirConvertServerURL(): string {
    return getEnvVarOrFail("FHIR_CONVERTER_SERVER_URL");
  }
  static getFhirConversionBucketName(): string {
    return getEnvVarOrFail("FHIR_CONVERTER_BUCKET_NAME");
  }

  static getAnalyticsBucketName(): string {
    return getEnvVarOrFail("ANALYTICS_BUCKET_NAME");
  }
  static getAnalyticsDbCreds(): DbCreds {
    try {
      return dbCredsSchema.parse(JSON.parse(getEnvVarOrFail("ANALYTICS_DB_CREDS")));
    } catch (error) {
      throw new MetriportError("Error parsing analytics db creds", error);
    }
  }
  static getAnalyticsDbReaderHost(): string {
    return getEnvVarOrFail("ANALYTICS_DB_READER_HOST");
  }
  static getAnalyticsDbReaderCname(): string {
    return getEnvVarOrFail("ANALYTICS_DB_READER_CNAME");
  }
  static getCreateFhirTablesLambdaName(): string {
    return getEnvVarOrFail("CREATE_FHIR_TABLES_LAMBDA_NAME");
  }
  static getFhirToCsvDbUsername(): string {
    return getEnvVarOrFail("FHIR_TO_CSV_DB_USERNAME");
  }
  static getFhirToCsvDbPassword(): string {
    return getEnvVarOrFail("FHIR_TO_CSV_DB_PASSWORD");
  }
  static getRawToCoreDbUsername(): string {
    return getEnvVarOrFail("RAW_TO_CORE_DB_USERNAME");
  }
  static getRawToCoreDbPassword(): string {
    return getEnvVarOrFail("RAW_TO_CORE_DB_PASSWORD");
  }

  // ENG-536 remove this once we automatically find the discharge summary
  static getDischargeNotificationSlackUrl(): string {
    return getEnvVarOrFail("DISCHARGE_NOTIFICATION_SLACK_URL");
  }

  static getFhirToCsvBulkQueueUrl(): string {
    return getEnvVarOrFail("FHIR_TO_CSV_BULK_QUEUE_URL");
  }
  static getFhirToCsvIncrementalQueueUrl(): string {
    return getEnvVarOrFail("FHIR_TO_CSV_INCREMENTAL_QUEUE_URL");
  }
  static getFhirToCsvTransformLambdaName(): string {
    return getEnvVarOrFail("FHIR_TO_CSV_TRANSFORM_LAMBDA_NAME");
  }
  static getFhirToCsvTransformHttpEndpoint(): string {
    return getEnvVar("FHIR_TO_CSV_TRANSFORM_HTTP_ENDPOINT") ?? "http://localhost:8001";
  }

  static getCqlTransformQueueUrl(): string {
    return getEnvVarOrFail("CQL_TRANSFORM_QUEUE_URL");
  }
  static getHedisCliLambdaName(): string {
    return getEnvVarOrFail("HEDIS_CLI_LAMBDA_NAME");
  }
  static getHedisCliTransformHttpEndpoint(): string {
    return getEnvVar("HEDIS_CLI_TRANSFORM_HTTP_ENDPOINT") ?? "http://localhost:8002";
  }

  static getRawToCoreTriggerQueueUrl(): string {
    return getEnvVarOrFail("RAW_TO_CORE_TRIGGER_QUEUE_URL");
  }
  static getRawToCoreCompletionTopicArn(): string | undefined {
    return getEnvVar("RAW_TO_CORE_COMPLETION_TOPIC_ARN");
  }
  static getRawToCoreBatchJobQueueArn(): string {
    return getEnvVarOrFail("RAW_TO_CORE_BATCH_JOB_QUEUE_ARN");
  }
  static getRawToCoreBatchJobDefinitionArn(): string {
    return getEnvVarOrFail("RAW_TO_CORE_BATCH_JOB_DEFINITION_ARN");
  }
  static getRawToCoreHttpEndpoint(): string {
    return getEnvVar("RAW_TO_CORE_TRANSFORM_HTTP_ENDPOINT") ?? "http://localhost:8003";
  }
  static getCoreToHedisTriggerQueueUrl(): string {
    return getEnvVarOrFail("CORE_TO_HEDIS_TRIGGER_QUEUE_URL");
  }
  static getCoreToHedisCompletionTopicArn(): string | undefined {
    return getEnvVar("CORE_TO_HEDIS_COMPLETION_TOPIC_ARN");
  }
  static getCoreToHedisBatchJobQueueArn(): string {
    return getEnvVarOrFail("CORE_TO_HEDIS_BATCH_JOB_QUEUE_ARN");
  }
  static getCoreToHedisBatchJobDefinitionArn(): string {
    return getEnvVarOrFail("CORE_TO_HEDIS_BATCH_JOB_DEFINITION_ARN");
  }
  static getCoreToHedisHttpEndpoint(): string {
    return getEnvVar("CORE_TO_HEDIS_TRANSFORM_HTTP_ENDPOINT") ?? "http://localhost:8004";
  }
  static getExportCoreFromFwhToS3QueueUrl(): string {
    return getEnvVarOrFail("EXPORT_CORE_FROM_FWH_TO_S3_QUEUE_URL");
  }
  static getExportCoreFromFwhToS3CompletionTopicArn(): string | undefined {
    return getEnvVar("EXPORT_CORE_FROM_FWH_TO_S3_COMPLETION_TOPIC_ARN");
  }
  static getExportCoreFromFwhToS3BatchJobQueueArn(): string {
    return getEnvVarOrFail("EXPORT_CORE_FROM_FWH_TO_S3_BATCH_JOB_QUEUE_ARN");
  }
  static getExportCoreFromFwhToS3BatchJobDefinitionArn(): string {
    return getEnvVarOrFail("EXPORT_CORE_FROM_FWH_TO_S3_BATCH_JOB_DEFINITION_ARN");
  }
  // Connector ingestion
  static getSnowflakeConnectorQueueUrl(): string {
    return getEnvVarOrFail("SNOWFLAKE_CONNECTOR_QUEUE_URL");
  }
  static getSnowflakeConnectorBatchJobQueueArn(): string {
    return getEnvVarOrFail("SNOWFLAKE_CONNECTOR_BATCH_JOB_QUEUE_ARN");
  }
  static getSnowflakeConnectorBatchJobDefinitionArn(): string {
    return getEnvVarOrFail("SNOWFLAKE_CONNECTOR_BATCH_JOB_DEFINITION_ARN");
  }
  static getConnectorIngestionCompleteTopicArn(): string | undefined {
    return getEnvVar("CONNECTOR_INGESTION_COMPLETE_TOPIC_ARN");
  }
  static getSnowflakeCredsForAllRegions(): SnowflakeCreds {
    try {
      return snowflakeCredsSchema.parse(
        JSON.parse(getEnvVarOrFail("SNOWFLAKE_CREDS_FOR_ALL_REGIONS"))
      );
    } catch (error) {
      throw new MetriportError("Error parsing snowflake creds", error);
    }
  }
  static getSnowflakeSettingsForAllCustomers(): SnowflakeSettingsForAllCxs {
    try {
      return snowflakeSettingsForAllCxsSchema.parse(
        JSON.parse(getEnvVarOrFail("SNOWFLAKE_SETTINGS_FOR_ALL_CXS"))
      );
    } catch (error) {
      throw new MetriportError("Error parsing snowflake settings for all customers", error);
    }
  }

  static getRosterUploadSftpPasswordName(): string {
    return getEnvVarOrFail(`${ROSTER_UPLOAD_SFTP_PASSWORD}_NAME`);
  }

  static getLahieIngestionLambdaName(): string {
    return getEnvVarOrFail("LAHIE_INGESTION_LAMBDA_NAME");
  }

  static getLahieIngestionRemotePath(): string {
    return getEnvVarOrFail("LAHIE_INGESTION_REMOTE_PATH");
  }

  static getLahieConfig(): Record<string, unknown> {
    return getEnvVarAsRecordOrFail("LAHIE_CONFIG");
  }

  static getLahieIngestionHost(): string {
    return getEnvVarOrFail("LAHIE_INGESTION_HOST");
  }

  static getLahieIngestionUsername(): string {
    return getEnvVarOrFail("LAHIE_INGESTION_USERNAME");
  }

  static getLahieIngestionPort(): number {
    const port = Number.parseInt(getEnvVarOrFail("LAHIE_INGESTION_PORT"));
    if (isFinite(port)) {
      return port;
    }
    throw new Error("Lahie ingestion port is not a valid number");
  }

  static getLahieIngestionPasswordArn(): string {
    return getEnvVarOrFail("LAHIE_INGESTION_PASSWORD_ARN");
  }

  static getLahieIngestionBucket(): string {
    return getEnvVarOrFail("LAHIE_INGESTION_BUCKET_NAME");
  }

  static getLahieIngestionPrivateKeyArn(): string {
    return getEnvVarOrFail("LAHIE_INGESTION_PRIVATE_KEY_ARN");
  }

  static getLahieIngestionPrivateKeyPassphraseArn(): string {
    return getEnvVarOrFail("LAHIE_INGESTION_PRIVATE_KEY_PASSPHRASE_ARN");
  }

  static getInternalServerUrl(): string {
    return getEnvVarOrFail("INTERNAL_SERVER_BASE_URL");
  }

  static getAlohrIngestionBucket(): string {
    return getEnvVarOrFail("ALOHR_INGESTION_BUCKET_NAME");
  }

  static getAlohrIngestionRemotePath(): string {
    return getEnvVarOrFail("ALOHR_INGESTION_REMOTE_PATH");
  }

  static getAlohrIngestionPasswordArn(): string {
    return getEnvVarOrFail("ALOHR_INGESTION_PASSWORD_ARN");
  }

  static getAlohrIngestionSftpConfig(): Partial<SftpConfig> {
    return getEnvVarAsRecordOrFail("ALOHR_INGESTION_SFTP_CONFIG");
  }

  static getAlohrIngestionLambdaName(): string {
    return getEnvVarOrFail("ALOHR_INGESTION_LAMBDA_NAME");
  }

  static getAlohrIngestionTimezone(): string {
    return getEnvVarOrFail("ALOHR_INGESTION_TIMEZONE");
  }

  static getAiBriefBucketName(): string {
    return getEnvVarOrFail("AI_BRIEF_BUCKET_NAME");
  }

  static getHeartBeatMonitorMap(): Record<string, string> {
    return getEnvVarAsRecordOrFail("HEARTBEAT_MONITOR_MAP");
  }

  static getOutboundRateLimitTableName(): string | undefined {
    return getEnvVar("OUTBOUND_RATE_LIMIT_TABLE_NAME");
  }

  static getHeartbeatCheckId(): string {
    return getEnvVarOrFail("HEARTBEAT_CHECK_ID");
  }

  static getChecklyApiKey(): string {
    return getEnvVarOrFail("CHECKLY_API_KEY_SECRET");
  }

  static getChecklyAccountId(): string {
    return getEnvVarOrFail("CHECKLY_ACCOUNT_ID_SECRET");
  }

  static getDocIdMappingTableName(): string {
    return getEnvVarOrFail("DOC_ID_MAPPING_TABLE_NAME");
  }
}
