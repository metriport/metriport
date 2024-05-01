import { EnvType } from "../lib/env-type";
import { IHEGatewayProps } from "./ihe-gateway-config";

export type ConnectWidgetConfig = {
  stackName: string;
  region: string;
  subdomain: string;
  host: string;
  domain: string;
};

export type CWCoverageEnhancementConfig = {
  managementUrl: string;
  codeChallengeNotificationUrl: string;
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
  apiDatabase: {
    /**
     * The name of the database.
     */
    name: string;
    /**
     * The API username to connect to the database.
     */
    username: string;
    /**
     * From CDK: A preferred maintenance window day/time range. Should be specified as a range ddd:hh24:mi-ddd:hh24:mi (24H Clock UTC).
     *
     * Example: 'Sun:23:45-Mon:00:15'.
     *
     * Must be at least 30 minutes long.
     *
     * @see: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/USER_UpgradeDBInstance.Maintenance.html#Concepts.DBMaintenance
     */
    maintenanceWindow: string;
    /**
     * From CDK: The minimum number of Aurora capacity units (ACUs) for a DB instance in an Aurora Serverless v2 cluster.
     *
     * You can specify ACU values in half-step increments, such as 8, 8.5, 9, and so on. The smallest value that you can use is 0.5.
     *
     * @see — http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-rds-dbcluster-serverlessv2scalingconfiguration.html#cfn-rds-dbcluster-serverlessv2scalingconfiguration-mincapacity
     */
    minCapacity: number;
    /**
     * From CDK: The maximum number of Aurora capacity units (ACUs) for a DB instance in an Aurora Serverless v2 cluster.
     *
     * You can specify ACU values in half-step increments, such as 40, 40.5, 41, and so on. The largest value that you can use is 128.
     *
     * The maximum capacity must be higher than 0.5 ACUs. For more information, see Choosing the maximum Aurora Serverless v2 capacity setting for a cluster in the Amazon Aurora User Guide.
     *
     * @see — http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-rds-dbcluster-serverlessv2scalingconfiguration.html#cfn-rds-dbcluster-serverlessv2scalingconfiguration-maxcapacity
     */
    maxCapacity: number;
    /**
     * The minimum duration in milliseconds for a slow log to be recorded.
     *
     * If not present, slow logs will not be recorded.
     *
     * @see: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraPostgreSQL.Reference.ParameterGroups.html#AuroraPostgreSQL.Reference.Parameters.Cluster
     */
    minSlowLogDurationInMs?: number;
  };
  loadBalancerDnsName: string;
  apiGatewayUsagePlanId?: string; // optional since we need to create the stack first, then update this and redeploy
  usageReportUrl?: string;
  fhirServerUrl: string;
  fhirServerQueueUrl?: string;
  systemRootOID: string;
  systemRootOrgName: string;
  generalBucketName: string;
  medicalDocumentsBucketName: string;
  medicalDocumentsUploadBucketName: string;
  fhirConverterBucketName?: string;
  analyticsSecretNames?: {
    POST_HOG_API_KEY: string;
  };
  locationService?: {
    stackName: string;
    placeIndexName: string;
    placeIndexRegion: string;
  };
  carequality?: {
    secretNames?: {
      CQ_MANAGEMENT_API_KEY: string;
      CQ_ORG_PRIVATE_KEY: string;
      CQ_ORG_CERTIFICATE: string;
      CQ_ORG_CERTIFICATE_INTERMEDIATE: string;
      CQ_ORG_PRIVATE_KEY_PASSWORD: string;
    };
    envVars?: {
      CQ_ORG_URLS?: string;
      CQ_URLS_TO_EXCLUDE?: string;
    };
  };
  commonwell: {
    coverageEnhancement?: CWCoverageEnhancementConfig;
    envVars: {
      CW_MEMBER_NAME: string;
      CW_MEMBER_OID: string;
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
  // Secret props should be in upper case because they become env vars for ECS
  cwSecretNames: {
    // TODO 1195 Either remove or re-enable this and finish building it
    // CW_MANAGEMENT_CREDS?: string;
    CW_ORG_PRIVATE_KEY: string;
    CW_ORG_CERTIFICATE: string;
    CW_MEMBER_PRIVATE_KEY: string;
    CW_MEMBER_CERTIFICATE: string;
    CW_GATEWAY_AUTHORIZATION_CLIENT_ID: string;
    CW_GATEWAY_AUTHORIZATION_CLIENT_SECRET: string;
  };
  iheGateway?: IHEGatewayProps;
  sentryDSN?: string; // API's Sentry DSN
  lambdasSentryDSN?: string;
  slack?: {
    SLACK_ALERT_URL?: string;
    SLACK_NOTIFICATION_URL?: string;
    workspaceId: string;
    alertsChannelId: string;
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
  };
};

export type EnvConfigNonSandbox = EnvConfigBase & {
  environmentType: EnvType.staging | EnvType.production;
  fhirToMedicalLambda: {
    nodeRuntimeArn: string;
  };
  connectWidget: ConnectWidgetConfig;
};

export type EnvConfigSandbox = EnvConfigBase & {
  environmentType: EnvType.sandbox;
  connectWidgetUrl: string;
  sandboxSeedDataBucketName: string;
};

export type EnvConfig = EnvConfigSandbox | EnvConfigNonSandbox;
