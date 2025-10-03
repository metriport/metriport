import { CqDirectorySimplifiedOrg } from "@metriport/shared/interface/external/carequality/directory/simplified-org";
import { EnvType } from "../lib/env-type";
import { AnalyticsPlatformConfig } from "./analytics-platform-config";
import { RDSConfig } from "./aws/rds";
import { Hl7NotificationConfig } from "./hl7-notification-config";
import { IHEGatewayProps } from "./ihe-gateway-config";
import { OpenSearchConnectorConfig } from "./open-search-config";
import { PatientImportProps } from "./patient-import";

export type ConnectWidgetConfig = {
  stackName: string;
  region: string;
  subdomain: string;
  host: string;
  domain: string;
};

type EnvConfigBase = {
  environmentType: EnvType;
  stackName: string;
  secretsStackName: string;
  region: string;
  secretReplicaRegion?: string;
  host: string; // DNS Zone
  domain: string; // Base domain
  subdomain: string; // API subdomain
  authSubdomain: string; // Authentication subdomain
  apiDatabase: RDSConfig & {
    /**
     * Sequelize DB pool settings.
     */
    poolSettings: {
      /**
       * Maximum number of connections in pool. Default is 5.
       * It should be lower than the DB's max connections.
       * For Aurora Serverless v2, that's tied to `maxCapacity`.
       * @see https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.setting-capacity.html#aurora-serverless-v2.max-connections
       */
      max: number;
      /**
       * Minimum number of connections in pool. Default is 0.
       * @see https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.setting-capacity.html#aurora-serverless-v2.max-connections
       */
      min: number;
      /** The maximum time, in milliseconds, that pool will try to get connection before throwing error. */
      acquire: number;
      /** The maximum time, in milliseconds, that a connection can be idle before being released. */
      idle: number;
    };
  };
  loadBalancerDnsName: string;
  /**
   * Introduced when we had to recreate the Fargate service, so we could keep using the existing log group.
   */
  logArn: string;
  apiGatewayUsagePlanId?: string; // optional since we need to create the stack first, then update this and redeploy
  propelAuth: {
    authUrl: string;
    publicKey: string;
    secrets: {
      PROPELAUTH_API_KEY: string;
    };
  };
  internalServerUrl?: string;
  usageReportUrl?: string;
  cxBillingUrl?: string;
  fhirServerUrl: string;
  termServerUrl?: string;
  fhirServerQueueUrl?: string;
  systemRootOID: string;
  systemRootOrgName: string;
  generalBucketName: string;
  medicalDocumentsBucketName: string;
  medicalDocumentsUploadBucketName: string;
  pharmacyConversionBucketName: string;
  surescriptsReplicaBucketName: string;
  labConversionBucketName?: string;
  questReplicaBucketName?: string;
  ehrResponsesBucketName?: string;
  ehrBundleBucketName: string;
  iheResponsesBucketName: string;
  iheParsedResponsesBucketName: string;
  iheRequestsBucketName: string;
  fhirConverterBucketName?: string;
  analyticsSecretNames: {
    POST_HOG_API_KEY_SECRET: string;
  };
  locationService?: {
    stackName: string;
    placeIndexName: string;
    placeIndexRegion: string;
  };
  bedrock?: {
    modelId: string;
    region: string;
    anthropicVersion: string;
  };
  openSearch: OpenSearchConnectorConfig;
  carequality?: {
    roUsername: string;
    secretNames: {
      CQ_MANAGEMENT_API_KEY: string;
      CQ_ORG_PRIVATE_KEY: string;
      CQ_ORG_CERTIFICATE: string;
      CQ_ORG_CERTIFICATE_INTERMEDIATE: string;
      CQ_ORG_PRIVATE_KEY_PASSWORD: string;
    };
    envVars?: {
      CQ_ORG_URLS?: string;
      CQ_URLS_TO_EXCLUDE?: string;
      CQ_ADDITIONAL_ORGS?: CqDirectorySimplifiedOrg[];
    };
  };
  commonwell: {
    envVars: {
      CW_MEMBER_NAME: string;
      CW_MEMBER_OID: string;
      CW_MEMBER_ID: string;
      CW_GATEWAY_ENDPOINT: string;
      CW_GATEWAY_AUTHORIZATION_SERVER_ENDPOINT: string;
      CW_TECHNICAL_CONTACT_NAME: string;
      CW_TECHNICAL_CONTACT_TITLE: string;
      CW_TECHNICAL_CONTACT_EMAIL: string;
      CW_TECHNICAL_CONTACT_PHONE: string;
    };
  };
  // Secret props should be in upper case because they become env vars for ECS
  providerSecretNames: {
    CRONOMETER_CLIENT_ID: string;
    CRONOMETER_CLIENT_SECRET: string;
    DEXCOM_CLIENT_ID: string;
    DEXCOM_CLIENT_SECRET: string;
    FITBIT_CLIENT_ID: string;
    FITBIT_CLIENT_SECRET: string;
    FITBIT_SUBSCRIBER_VERIFICATION_CODE: string;
    GARMIN_CONSUMER_KEY: string;
    GARMIN_CONSUMER_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    OURA_CLIENT_ID: string;
    OURA_CLIENT_SECRET: string;
    WITHINGS_CLIENT_ID: string;
    WITHINGS_CLIENT_SECRET: string;
    WHOOP_CLIENT_ID: string;
    WHOOP_CLIENT_SECRET: string;
    TENOVI_AUTH_HEADER: string;
  };
  // TODO move this under `commonwell`
  // Secret props should be in upper case because they become env vars for ECS
  cwSecretNames: {
    CW_ORG_PRIVATE_KEY: string;
    CW_ORG_CERTIFICATE: string;
    CW_MEMBER_PRIVATE_KEY: string;
    CW_MEMBER_CERTIFICATE: string;
    CW_GATEWAY_AUTHORIZATION_CLIENT_ID: string;
    CW_GATEWAY_AUTHORIZATION_CLIENT_SECRET: string;
  };
  iheGateway?: IHEGatewayProps;
  patientImport: PatientImportProps;
  canvas?: {
    secretNames: {
      CANVAS_CLIENT_ID: string;
      CANVAS_CLIENT_SECRET: string;
      CANVAS_ENVIRONMENT: string;
    };
  };
  sentryDSN?: string; // API's Sentry DSN
  lambdasSentryDSN?: string;
  slack: {
    SLACK_ALERT_URL: string;
    SLACK_NOTIFICATION_URL: string;
    SLACK_SENSITIVE_DATA_URL?: string;
    workspaceId: string;
    alertsChannelId: string;
  };
  acmCertMonitor: {
    /**
     * UTC-based: "Minutes Hours Day-of-month Month Day-of-week Year"
     * @see: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-cron-expressions.html
     * @see: https://docs.aws.amazon.com/lambda/latest/dg/services-cloudwatchevents-expressions.html
     */
    scheduleExpressions: string | string[];
    heartbeatUrl: string;
  };
  docQueryChecker?: {
    /**
     * UTC-based: "Minutes Hours Day-of-month Month Day-of-week Year"
     * @see: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-cron-expressions.html
     * @see: https://docs.aws.amazon.com/lambda/latest/dg/services-cloudwatchevents-expressions.html
     */
    scheduleExpressions: string | string[];
  };
  cqDirectoryRebuilder?: {
    scheduleExpressions: string | string[];
    heartbeatUrl?: string;
  };
  ehrIntegration?: {
    athenaHealth: {
      env: string;
      secrets: {
        EHR_ATHENA_CLIENT_KEY: string;
        EHR_ATHENA_CLIENT_SECRET: string;
      };
    };
    elation: {
      env: string;
      secrets: {
        EHR_ELATION_CLIENT_KEY_AND_SECRET_MAP: string;
      };
    };
    canvas: {
      secrets: {
        EHR_CANVAS_CLIENT_KEY_AND_SECRET_MAP: string;
      };
    };
    healthie: {
      env: string;
      secrets: {
        EHR_HEALTHIE_API_KEY_MAP: string;
      };
    };
    eclinicalworks: {
      env: string;
    };
    salesforce: {
      env: string;
    };
  };
  surescripts?: {
    surescriptsSenderId: string;
    surescriptsReceiverId: string;
    surescriptsHost: string;
    secrets: {
      SURESCRIPTS_SFTP_SENDER_PASSWORD: string;
      SURESCRIPTS_SFTP_PUBLIC_KEY: string;
      SURESCRIPTS_SFTP_PRIVATE_KEY: string;
    };
  };
  quest?: {
    questHostname: string;
    questPort: number;
    questUsername: string;
    questOutgoingDirectoryPath: string;
    questIncomingDirectoryPath: string;
    secrets: {
      QUEST_SFTP_PASSWORD: string;
    };
  };
  jobs: {
    startScheduledPatientJobsScheduleExpression: string;
    startScheduledPatientJobsSchedulerUrl: string;
  };
};

export type EnvConfigNonSandbox = EnvConfigBase & {
  environmentType: EnvType.staging | EnvType.production;
  dashUrl: string;
  ehrDashUrl: string;
  // TODO 1672 remove this when we remove the old lambda that relies on Puppeteer
  fhirToMedicalLambda: {
    nodeRuntimeArn: string;
  };
  connectWidget: ConnectWidgetConfig;
  engineeringCxId: string;
  hl7Notification: Hl7NotificationConfig;
  fhirConversionBucketName: string;
  analyticsPlatform: AnalyticsPlatformConfig;
  aiBriefBucketName: string;
};

export type EnvConfigSandbox = EnvConfigBase & {
  environmentType: EnvType.sandbox;
  connectWidgetUrl: string;
  sandboxSeedDataBucketName: string;
  engineeringCxId?: never;
  hl7Notification?: never;
};

export type EnvConfig = EnvConfigSandbox | EnvConfigNonSandbox;
