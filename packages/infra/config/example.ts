import { Duration } from "aws-cdk-lib";
import { EbsDeviceVolumeType } from "aws-cdk-lib/aws-ec2";
import { EnvType } from "../lib/env-type";
import { EnvConfigNonSandbox } from "./env-config";
import { vCPU } from "../lib/shared/fargate";

export const config: EnvConfigNonSandbox = {
  stackName: "MetriportInfraStack",
  secretsStackName: "MetriportSecretsStack",
  environmentType: EnvType.production,
  region: "us-east-1",
  host: "myhealthapp.com",
  domain: "myhealthapp.com",
  subdomain: "api",
  authSubdomain: "auth",
  apiDatabase: {
    name: "my_db",
    username: "my_db_user",
    maintenanceWindow: "Sun:02:00-Sun:02:30",
    minCapacity: 0.5,
    maxCapacity: 1,
    alarmThresholds: {
      acuUtilizationPct: 80,
      cpuUtilizationPct: 80,
      freeableMemoryMb: 1_000,
      volumeReadIops: 2_000,
      volumeWriteIops: 2_000,
    },
    poolSettings: {
      max: 200,
      min: 10,
      acquire: 5_000,
      idle: 5_000,
    },
  },
  loadBalancerDnsName: "<your-load-balancer-dns-name>",
  logArn: "<your-log-arn>",
  propelAuth: {
    authUrl: "url-to-propel-auth",
    publicKey: "-----BEGIN PUBLIC KEY-----\nEXAMPLE\n-----END PUBLIC KEY-----",
    secrets: {
      PROPELAUTH_API_KEY: "key-name",
    },
  },
  dashUrl: "https://url-of-your-dashboard.com",
  fhirToMedicalLambda: {
    nodeRuntimeArn: "arn:aws:lambda:<region>::runtime:<id>",
  },
  fhirServerUrl: "http://localhost:8888",
  termServerUrl: "http://localhost:8666",
  systemRootOID: "2.16.840.1.113883.3.999999",
  systemRootOrgName: "Name of the Organization",
  providerSecretNames: {
    CRONOMETER_CLIENT_ID: "CRONOMETER_CLIENT_ID",
    CRONOMETER_CLIENT_SECRET: "CRONOMETER_CLIENT_SECRET",
    DEXCOM_CLIENT_ID: "DEXCOM_CLIENT_ID",
    DEXCOM_CLIENT_SECRET: "DEXCOM_CLIENT_SECRET",
    FITBIT_CLIENT_ID: "FITBIT_CLIENT_ID",
    FITBIT_CLIENT_SECRET: "FITBIT_CLIENT_SECRET",
    FITBIT_SUBSCRIBER_VERIFICATION_CODE: "FITBIT_SUBSCRIBER_VERIFICATION_CODE",
    GARMIN_CONSUMER_KEY: "GARMIN_CONSUMER_KEY",
    GARMIN_CONSUMER_SECRET: "GARMIN_CONSUMER_SECRET",
    GOOGLE_CLIENT_ID: "GOOGLE_CLIENT_ID",
    GOOGLE_CLIENT_SECRET: "GOOGLE_CLIENT_SECRET",
    OURA_CLIENT_ID: "OURA_CLIENT_ID",
    OURA_CLIENT_SECRET: "OURA_CLIENT_SECRET",
    WITHINGS_CLIENT_ID: "WITHINGS_CLIENT_ID",
    WITHINGS_CLIENT_SECRET: "WITHINGS_CLIENT_SECRET",
    WHOOP_CLIENT_ID: "WHOOP_CLIENT_ID",
    WHOOP_CLIENT_SECRET: "WHOOP_CLIENT_SECRET",
    TENOVI_AUTH_HEADER: "TENOVI_AUTH_HEADER",
  },
  cwSecretNames: {
    CW_ORG_PRIVATE_KEY: "CW_ORG_PRIVATE_KEY",
    CW_ORG_CERTIFICATE: "CW_ORG_CERTIFICATE",
    CW_MEMBER_PRIVATE_KEY: "CW_MEMBER_PRIVATE_KEY",
    CW_MEMBER_CERTIFICATE: "CW_MEMBER_CERTIFICATE",
    CW_GATEWAY_AUTHORIZATION_CLIENT_ID: "CW_GATEWAY_AUTHORIZATION_CLIENT_ID",
    CW_GATEWAY_AUTHORIZATION_CLIENT_SECRET: "CW_GATEWAY_AUTHORIZATION_CLIENT_SECRET",
  },
  patientImport: {
    bucketName: "your-bucket-name",
    notificationUrl: "the-notification-url",
  },
  connectWidget: {
    stackName: "MetriportConnectInfraStack",
    region: "us-east-1",
    subdomain: "connect",
    domain: "myhealthapp.com",
    host: "myhealthapp.com",
  },
  locationService: {
    stackName: "MetriportLocationServiceStack",
    placeIndexName: "your_place_index_name",
    placeIndexRegion: "aws_region",
  },
  carequality: {
    secretNames: {
      CQ_MANAGEMENT_API_KEY: "CQ_MANAGEMENT_API_KEY",
      CQ_ORG_PRIVATE_KEY: "CQ_ORG_PRIVATE_KEY",
      CQ_ORG_CERTIFICATE: "CQ_ORG_CERTIFICATE",
      CQ_ORG_CERTIFICATE_INTERMEDIATE: "CQ_ORG_CERTIFICATE_INTERMEDIATE",
      CQ_ORG_PRIVATE_KEY_PASSWORD: "CQ_ORG_PRIVATE_KEY_PASSWORD",
    },
    envVars: {
      CQ_ORG_URLS: `{"urlXCPD": "https://api.myhealthapp.com/xcpd","urlDQ": "https://api.myhealthapp.com/xca-dq","urlDR": "https://api.myhealthapp.com/xca-dr"}`,
      CQ_URLS_TO_EXCLUDE:
        "https://commonwell.com/patient-discovery-routes/,https://ehealthexchange.org/patient-discovery-routes/",
    },
  },
  commonwell: {
    envVars: {
      CW_MEMBER_NAME: "Test Org",
      CW_MEMBER_OID: "1.2.3.1.4.1.11.12.29.2022.123",
      CW_GATEWAY_ENDPOINT: "https://api.myhealthapp.com/oauth/fhir",
      CW_GATEWAY_AUTHORIZATION_SERVER_ENDPOINT:
        "https://myhealthapp.auth.us-east-1.amazoncognito.com/oauth2/token",
      CW_TECHNICAL_CONTACT_NAME: "Engineering",
      CW_TECHNICAL_CONTACT_TITLE: "Engineering",
      CW_TECHNICAL_CONTACT_EMAIL: "support@healthapp.com",
      CW_TECHNICAL_CONTACT_PHONE: "(123)-123-1234",
    },
  },
  openSearch: {
    openSearch: {
      capacity: {
        dataNodes: 2,
        dataNodeInstanceType: "t3.medium.search",
        masterNodes: 0,
        masterNodeInstanceType: undefined,
        warmNodes: 0,
      },
      ebs: {
        volumeSize: 10,
        volumeType: EbsDeviceVolumeType.GENERAL_PURPOSE_SSD_GP3,
      },
      encryptionAtRest: true,
      indexName: "test-index-name",
    },
    lambda: {
      memory: 512,
      batchSize: 1,
      maxConcurrency: 5,
      timeout: Duration.minutes(2),
    },
  },
  generalBucketName: "test-bucket",
  hl7NotificationRouting: {
    vpnConfigs: [
      {
        partnerName: "SampleHIE",
        partnerGatewayPublicIp: "200.54.1.1",
        staticRoutesOnly: true,
      },
    ],
    mllpServer: {
      fargateCpu: 1 * vCPU,
      fargateMemoryLimitMiB: 2048,
      fargateTaskCountMin: 2,
      fargateTaskCountMax: 4,
    },
  },
  medicalDocumentsBucketName: "test-bucket",
  medicalDocumentsUploadBucketName: "test-upload-bucket",
  ehrResponsesBucketName: "test-ehr-responses-bucket",
  iheResponsesBucketName: "test-ihe-responses-bucket",
  iheParsedResponsesBucketName: "test-ihe-parsed-responses-bucket",
  iheRequestsBucketName: "test-ihe-requests-bucket",
  engineeringCxId: "12345678-1234-1234-1234-123456789012",
};
export default config;
