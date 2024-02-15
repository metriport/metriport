import { EnvType } from "../lib/env-type";
import { EnvConfig } from "./env-config";

export const config: EnvConfig = {
  stackName: "MetriportInfraStack",
  secretsStackName: "MetriportSecretsStack",
  environmentType: EnvType.production,
  region: "us-east-1",
  host: "myhealthapp.com",
  domain: "myhealthapp.com",
  subdomain: "api",
  authSubdomain: "auth",
  dbName: "my_db",
  dbUsername: "my_db_user",
  loadBalancerDnsName: "<your-load-balancer-dns-name>",
  fhirServerUrl: "http://localhost:8888",
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
  // TODO 1377 Update this
  // iheGateway: {
  //   vpcId: "<your-vpc-id>",
  //   certArn: "<your-cert-arn>",
  //   subdomain: "ihe",
  //   snsTopicArn: "<your-sns-topic-arn>",
  // },
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
      CQ_API_KEY: "CQ_API_KEY",
      CQ_ORG_PRIVATE_KEY: "CQ_ORG_PRIVATE_KEY",
      CQ_ORG_CERTIFICATE: "CQ_ORG_CERTIFICATE",
      CQ_ORG_PRIVATE_KEY_PASSWORD: "CQ_ORG_PRIVATE_KEY_PASSWORD",
    },
    envVars: {
      CQ_ORG_DETAILS: `{"name": "Test org","oid": "1.2.3.1.4.1.11.12.29.2022.1234","addressLine1": "123 Main St","city": "Phoenix","state": "AZ","zip": "12345","lat": "33.12345","lon": "-112.12345","urlXCPD": "https://api.myhealthapp.com/xcpd","urlDQ": "https://api.myhealthapp.com/xca-dq","urlDR": "https://api.myhealthapp.com/xca-dr","contactName": "Engineering","phone": "(123)-123-1234","email": "support@healthapp.com"}`,
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
  generalBucketName: "test-bucket",
  medicalDocumentsBucketName: "test-bucket",
  medicalDocumentsUploadBucketName: "test-upload-bucket",
  systemRootOID: "2.16.840.1.113883.3.999999",
};
export default config;
