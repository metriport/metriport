import { EnvType } from "../lib/env-type";

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

export type EnvConfig = {
  stackName: string;
  secretsStackName: string;
  region: string;
  secretReplicaRegion?: string;
  host: string; // DNS Zone
  domain: string; // Base domain
  subdomain: string; // API subdomain
  authSubdomain: string; // Authentication subdomain
  dbName: string;
  dbUsername: string;
  loadBalancerDnsName?: string;
  apiGatewayUsagePlanId?: string; // optional since we need to create the stack first, then update this and redeploy
  usageReportUrl?: string;
  fhirServerUrl: string;
  fhirServerQueueUrl?: string;
  systemRootOID: string;
  generalBucketName: string;
  medicalDocumentsBucketName: string;
  medicalDocumentsUploadBucketName: string;
  fhirConverterBucketName?: string;
  analyticsSecretNames?: {
    POST_HOG_API_KEY: string;
  };
  locationService: {
    stackName: string;
    placeIndexName: string;
    placeIndexRegion: string;
  };
  carequality?: {
    secretNames?: {
      CQ_API_KEY?: string;
    };
    envVars?: {
      CQ_ORG_DETAILS?: string;
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
  iheGateway?: {
    vpcId: string;
    certArn: string;
    subdomain: string; // Subdomain for IHE integrations
    snsTopicArn?: string;
  };
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
} & (
  | {
      environmentType: EnvType.staging | EnvType.production;
      connectWidget: ConnectWidgetConfig;
      connectWidgetUrl?: never;
      sandboxSeedDataBucketName?: never;
    }
  | {
      environmentType: EnvType.sandbox;
      connectWidget?: never;
      connectWidgetUrl: string;
      sandboxSeedDataBucketName: string;
    }
);
