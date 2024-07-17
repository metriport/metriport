import { Duration, NestedStack, NestedStackProps, Stack } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as r53 from "aws-cdk-lib/aws-route53";
import * as r53_targets from "aws-cdk-lib/aws-route53-targets";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as rds from "aws-cdk-lib/aws-rds";
import * as cert from "aws-cdk-lib/aws-certificatemanager";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as logs from "aws-cdk-lib/aws-logs";
import { CfnStage } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as sns from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";
import { EnvType } from "./env-type";
import { createLambda } from "./shared/lambda";
import { LambdaLayers } from "./shared/lambda-layers";
import { getSecrets, Secrets } from "./shared/secrets";
import { EnvConfig } from "../config/env-config";

const posthogSecretKey = "POST_HOG_API_KEY_SECRET";

interface IHEGatewayV2LambdasNestedStackProps extends NestedStackProps {
  config: EnvConfig;
  version: string | undefined;
  lambdaLayers: LambdaLayers;
  apiTaskRole: iam.IRole;
  vpc: ec2.IVpc;
  secrets: Secrets;
  cqOrgCertificate: string | undefined;
  cqOrgPrivateKey: string | undefined;
  cqOrgPrivateKeyPassword: string | undefined;
  cqOrgCertificateIntermediate: string | undefined;
  cqTrustBundleBucket: s3.IBucket;
  medicalDocumentsBucket: s3.Bucket;
  apiURL: string;
  envType: EnvType;
  sentryDsn: string | undefined;
  iheResponsesBucketName: string;
  dbSecretArn: string;
  dbCluster: rds.DatabaseCluster;
}

export class IHEGatewayV2LambdasNestedStack extends NestedStack {
  constructor(scope: Construct, id: string, props: IHEGatewayV2LambdasNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    const iheResponsesBucket = new s3.Bucket(this, "IHEResponsesBucket", {
      bucketName: props.iheResponsesBucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });

    const patientDiscoveryLambda = this.setupIHEGatewayV2PatientDiscoveryLambda(
      props,
      iheResponsesBucket
    );
    const documentQueryLambda = this.setupIHEGatewayV2DocumentQueryLambda(
      props,
      iheResponsesBucket
    );
    const documentRetrievalLambda = this.setupIHEGatewayV2DocumentRetrievalLambda(
      props,
      iheResponsesBucket
    );

    this.setupMockDirectDbClient(props);

    // granting lambda invoke access to api service
    patientDiscoveryLambda.grantInvoke(props.apiTaskRole);
    documentQueryLambda.grantInvoke(props.apiTaskRole);
    documentRetrievalLambda.grantInvoke(props.apiTaskRole);

    const vpcId = props.config.iheGateway?.vpcId;
    if (!vpcId) throw new Error("Missing VPC ID for IHE stack");
    const vpc = ec2.Vpc.fromLookup(this, "APIVpc", { vpcId });

    const alarmSnsAction = setupSlackNotifSnsTopic(this, props.config);

    //-------------------------------------------
    // Secrets
    //-------------------------------------------
    const secrets = getSecrets(this, props.config);

    //-------------------------------------------
    // API Gateway
    //-------------------------------------------
    if (!props.config.iheGateway) {
      throw new Error("Must define IHE properties!");
    }
    const iheApiUrl = `${props.config.iheGateway.subdomain}.${props.config.domain}`;

    // get the public zone
    const publicZone = r53.HostedZone.fromLookup(this, "Zone", {
      domainName: props.config.host,
    });

    // get the certificate from ACM
    const certificate = cert.Certificate.fromCertificateArn(
      this,
      "IHECertificate",
      props.config.iheGateway.certArn
    );

    // get the ownership Certificate from ACM.
    const ownershipCertificate = new cert.Certificate(this, "OwnershipVerificationCertificate", {
      domainName: iheApiUrl,
      validation: cert.CertificateValidation.fromDns(publicZone),
    });

    const trustStoreBucket = s3.Bucket.fromBucketName(
      this,
      "TruststoreBucket",
      props.config.iheGateway.trustStoreBucketName
    );

    // get the medical documents bucket
    const medicalDocumentsBucket = s3.Bucket.fromBucketName(
      this,
      "ImportedMedicalDocumentsBucket",
      props.config.medicalDocumentsBucketName
    );

    // Create the API Gateway.
    const domainName = new apigwv2.DomainName(this, "IHEAPIDomainv2", {
      domainName: iheApiUrl,
      certificate: certificate,
      mtls: {
        bucket: trustStoreBucket,
        key: props.config.iheGateway.trustStoreKey,
      },
      // this ownsership cert is the whole point of this entire migration.
      ownershipCertificate: ownershipCertificate,
      securityPolicy: apigwv2.SecurityPolicy.TLS_1_2,
    });

    const apigw2 = new apigwv2.HttpApi(this, "IHEAPIGatewayv2", {
      defaultDomainMapping: {
        domainName: domainName,
      },
      corsPreflight: {
        allowOrigins: ["*"],
        allowHeaders: ["*"],
      },
      disableExecuteApiEndpoint: true,
    });

    // no feature to suuport this simply. Copied custom solution from https://github.com/aws/aws-cdk/issues/11100
    const accessLogs = new logs.LogGroup(this, "IHE-APIGW-AccessLogs");
    const stage = apigw2.defaultStage?.node.defaultChild as CfnStage;
    stage.accessLogSettings = {
      destinationArn: accessLogs.logGroupArn,
      format: JSON.stringify({
        requestId: "$context.requestId",
        userAgent: "$context.identity.userAgent",
        sourceIp: "$context.identity.sourceIp",
        requestTime: "$context.requestTime",
        requestTimeEpoch: "$context.requestTimeEpoch",
        httpMethod: "$context.httpMethod",
        path: "$context.path",
        status: "$context.status",
        protocol: "$context.protocol",
        responseLength: "$context.responseLength",
        domainName: "$context.domainName",
      }),
    };

    const role = new iam.Role(this, "ApiGWLogWriterRole", {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
    });

    const policy = new iam.PolicyStatement({
      actions: [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
        "logs:PutLogEvents",
        "logs:GetLogEvents",
        "logs:FilterLogEvents",
      ],
      resources: ["*"],
    });
    role.addToPolicy(policy);
    accessLogs.grantWrite(role);

    // TODO 1377 Setup WAF

    new r53.ARecord(this, "IHEAPIDomainRecordv2", {
      recordName: iheApiUrl,
      zone: publicZone,
      target: r53.RecordTarget.fromAlias(
        new r53_targets.ApiGatewayv2DomainProperties(
          domainName.regionalDomainName,
          domainName.regionalHostedZoneId
        )
      ),
    });

    const posthogSecretName = props.config.analyticsSecretNames?.POST_HOG_API_KEY_SECRET;

    const iheRequestsBucket = new s3.Bucket(this, "IHERequestsBucket", {
      bucketName: props.config.iheRequestsBucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });

    const patientDiscoveryLambdaV2 = this.setupPatientDiscoveryLambda({
      props: props.config,
      version: props.version,
      lambdaLayers: props.lambdaLayers,
      vpc,
      secrets,
      posthogSecretName,
      alarmSnsAction,
      iheRequestsBucket,
      dbCluster: props.dbCluster,
      dbSecretArn: props.dbSecretArn,
    });

    const documentQueryLambdaV2 = this.setupDocumentQueryLambda({
      props: props.config,
      version: props.version,
      lambdaLayers: props.lambdaLayers,
      vpc,
      secrets,
      medicalDocumentsBucket,
      posthogSecretName,
      alarmSnsAction,
      iheRequestsBucket,
    });

    const documentRetrievalLambdaV2 = this.setupDocumentRetrievalLambda({
      props: props.config,
      version: props.version,
      lambdaLayers: props.lambdaLayers,
      vpc,
      secrets,
      medicalDocumentsBucket,
      posthogSecretName,
      alarmSnsAction,
      iheRequestsBucket,
    });

    apigw2.addRoutes({
      path: "/v1/patient-discovery",
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration("IHEGWPDIntegrationV2", patientDiscoveryLambdaV2),
    });

    apigw2.addRoutes({
      path: "/v1/document-query",
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration("IHEGWDQIntegrationV2", documentQueryLambdaV2),
    });

    apigw2.addRoutes({
      path: "/v1/document-retrieve",
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration("IHEGWDRIntegrationV2", documentRetrievalLambdaV2),
    });
  }

  private grantSecretsReadAccess(
    lambdaFunction: Lambda,
    secrets: Secrets,
    secretKeys: string[]
  ): void {
    secretKeys.forEach(key => {
      if (!secrets[key]) {
        throw new Error(`${key} is not defined in config`);
      }
      secrets[key]?.grantRead(lambdaFunction);
    });
  }

  private setupIHEGatewayV2PatientDiscoveryLambda(
    ownProps: {
      lambdaLayers: LambdaLayers;
      vpc: ec2.IVpc;
      secrets: Secrets;
      cqOrgCertificate: string | undefined;
      cqOrgPrivateKey: string | undefined;
      cqOrgPrivateKeyPassword: string | undefined;
      cqOrgCertificateIntermediate: string | undefined;
      medicalDocumentsBucket: s3.Bucket;
      cqTrustBundleBucket: s3.IBucket;
      apiURL: string;
      envType: EnvType;
      sentryDsn: string | undefined;
      dbCluster: rds.IDatabaseCluster;
      dbSecretArn: string;
    },
    iheResponsesBucket: s3.Bucket
  ): Lambda {
    const {
      lambdaLayers,
      vpc,
      secrets,
      cqOrgCertificate,
      cqOrgPrivateKey,
      cqOrgPrivateKeyPassword,
      cqOrgCertificateIntermediate,
      medicalDocumentsBucket,
      cqTrustBundleBucket,
      apiURL,
      envType,
      sentryDsn,
      dbCluster,
      dbSecretArn,
    } = ownProps;

    const patientDiscoveryLambda = createLambda({
      stack: this,
      name: "IHEGatewayV2OutboundPatientDiscovery",
      entry: "ihe-gateway-v2-outbound-patient-discovery",
      envType: envType,
      envVars: {
        DB_RESOURCE_ARN: dbCluster.clusterArn,
        DB_SECRET_ARN: dbSecretArn,
        ...(cqOrgPrivateKey !== undefined && { CQ_ORG_PRIVATE_KEY: cqOrgPrivateKey }),
        ...(cqOrgCertificate !== undefined && { CQ_ORG_CERTIFICATE: cqOrgCertificate }),
        ...(cqOrgCertificateIntermediate !== undefined && {
          CQ_ORG_CERTIFICATE_INTERMEDIATE: cqOrgCertificateIntermediate,
        }),
        ...(cqOrgPrivateKeyPassword !== undefined && {
          CQ_ORG_PRIVATE_KEY_PASSWORD: cqOrgPrivateKeyPassword,
        }),
        ...(cqTrustBundleBucket !== undefined && {
          CQ_TRUST_BUNDLE_BUCKET_NAME: cqTrustBundleBucket.bucketName,
        }),
        API_URL: apiURL,
        MEDICAL_DOCUMENTS_BUCKET_NAME: medicalDocumentsBucket.bucketName,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        IHE_RESPONSES_BUCKET_NAME: iheResponsesBucket.bucketName,
      },
      layers: [lambdaLayers.shared],
      memory: 4096,
      timeout: Duration.minutes(10),
      vpc,
    });

    this.grantSecretsReadAccess(patientDiscoveryLambda, secrets, [
      "CQ_ORG_CERTIFICATE",
      "CQ_ORG_CERTIFICATE_INTERMEDIATE",
      "CQ_ORG_PRIVATE_KEY",
      "CQ_ORG_PRIVATE_KEY_PASSWORD",
    ]);

    iheResponsesBucket.grantReadWrite(patientDiscoveryLambda);
    medicalDocumentsBucket.grantRead(patientDiscoveryLambda);
    cqTrustBundleBucket.grantRead(patientDiscoveryLambda);
    dbCluster.grantDataApiAccess(patientDiscoveryLambda);

    return patientDiscoveryLambda;
  }

  private setupIHEGatewayV2DocumentQueryLambda(
    ownProps: {
      lambdaLayers: LambdaLayers;
      vpc: ec2.IVpc;
      secrets: Secrets;
      cqOrgCertificate: string | undefined;
      cqOrgPrivateKey: string | undefined;
      cqOrgPrivateKeyPassword: string | undefined;
      cqOrgCertificateIntermediate: string | undefined;
      cqTrustBundleBucket: s3.IBucket;
      medicalDocumentsBucket: s3.Bucket;
      apiURL: string;
      envType: EnvType;
      sentryDsn: string | undefined;
    },
    iheResponsesBucket: s3.Bucket
  ): Lambda {
    const {
      lambdaLayers,
      vpc,
      secrets,
      cqOrgCertificate,
      cqOrgPrivateKey,
      cqOrgPrivateKeyPassword,
      cqOrgCertificateIntermediate,
      cqTrustBundleBucket,
      medicalDocumentsBucket,
      apiURL,
      envType,
      sentryDsn,
    } = ownProps;

    const documentQueryLambda = createLambda({
      stack: this,
      name: "IHEGatewayV2OutboundDocumentQuery",
      entry: "ihe-gateway-v2-outbound-document-query",
      envType: envType,
      envVars: {
        ...(cqOrgPrivateKey !== undefined && { CQ_ORG_PRIVATE_KEY: cqOrgPrivateKey }),
        ...(cqOrgCertificate !== undefined && { CQ_ORG_CERTIFICATE: cqOrgCertificate }),
        ...(cqOrgCertificateIntermediate !== undefined && {
          CQ_ORG_CERTIFICATE_INTERMEDIATE: cqOrgCertificateIntermediate,
        }),
        ...(cqOrgPrivateKeyPassword !== undefined && {
          CQ_ORG_PRIVATE_KEY_PASSWORD: cqOrgPrivateKeyPassword,
        }),
        ...(cqTrustBundleBucket !== undefined && {
          CQ_TRUST_BUNDLE_BUCKET_NAME: cqTrustBundleBucket.bucketName,
        }),
        API_URL: apiURL,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        MEDICAL_DOCUMENTS_BUCKET_NAME: medicalDocumentsBucket.bucketName,
        IHE_RESPONSES_BUCKET_NAME: iheResponsesBucket.bucketName,
      },
      layers: [lambdaLayers.shared],
      memory: 1024,
      timeout: Duration.minutes(10),
      vpc,
    });

    this.grantSecretsReadAccess(documentQueryLambda, secrets, [
      "CQ_ORG_CERTIFICATE",
      "CQ_ORG_CERTIFICATE_INTERMEDIATE",
      "CQ_ORG_PRIVATE_KEY",
      "CQ_ORG_PRIVATE_KEY_PASSWORD",
    ]);

    iheResponsesBucket.grantReadWrite(documentQueryLambda);
    medicalDocumentsBucket.grantRead(documentQueryLambda);
    cqTrustBundleBucket.grantRead(documentQueryLambda);

    return documentQueryLambda;
  }

  private setupIHEGatewayV2DocumentRetrievalLambda(
    ownProps: {
      lambdaLayers: LambdaLayers;
      vpc: ec2.IVpc;
      secrets: Secrets;
      cqOrgCertificate: string | undefined;
      cqOrgPrivateKey: string | undefined;
      cqOrgPrivateKeyPassword: string | undefined;
      cqOrgCertificateIntermediate: string | undefined;
      cqTrustBundleBucket: s3.IBucket;
      medicalDocumentsBucket: s3.Bucket;
      apiURL: string;
      envType: EnvType;
      sentryDsn: string | undefined;
    },
    iheResponsesBucket: s3.Bucket
  ): Lambda {
    const {
      lambdaLayers,
      vpc,
      secrets,
      cqOrgCertificate,
      cqOrgPrivateKey,
      cqOrgPrivateKeyPassword,
      cqOrgCertificateIntermediate,
      cqTrustBundleBucket,
      medicalDocumentsBucket,
      apiURL,
      envType,
      sentryDsn,
    } = ownProps;

    const documentRetrievalLambda = createLambda({
      stack: this,
      name: "IHEGatewayV2OutboundDocumentRetrieval",
      entry: "ihe-gateway-v2-outbound-document-retrieval",
      envType: envType,
      envVars: {
        ...(cqOrgPrivateKey !== undefined && { CQ_ORG_PRIVATE_KEY: cqOrgPrivateKey }),
        ...(cqOrgCertificate !== undefined && { CQ_ORG_CERTIFICATE: cqOrgCertificate }),
        ...(cqOrgCertificateIntermediate !== undefined && {
          CQ_ORG_CERTIFICATE_INTERMEDIATE: cqOrgCertificateIntermediate,
        }),
        ...(cqOrgPrivateKeyPassword !== undefined && {
          CQ_ORG_PRIVATE_KEY_PASSWORD: cqOrgPrivateKeyPassword,
        }),
        ...(cqTrustBundleBucket !== undefined && {
          CQ_TRUST_BUNDLE_BUCKET_NAME: cqTrustBundleBucket.bucketName,
        }),
        API_URL: apiURL,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        MEDICAL_DOCUMENTS_BUCKET_NAME: medicalDocumentsBucket.bucketName,
        IHE_RESPONSES_BUCKET_NAME: iheResponsesBucket.bucketName,
      },
      layers: [lambdaLayers.shared],
      memory: 1024,
      timeout: Duration.minutes(15),
      vpc,
    });

    this.grantSecretsReadAccess(documentRetrievalLambda, secrets, [
      "CQ_ORG_CERTIFICATE",
      "CQ_ORG_CERTIFICATE_INTERMEDIATE",
      "CQ_ORG_PRIVATE_KEY",
      "CQ_ORG_PRIVATE_KEY_PASSWORD",
    ]);

    iheResponsesBucket.grantReadWrite(documentRetrievalLambda);
    medicalDocumentsBucket.grantReadWrite(documentRetrievalLambda);
    cqTrustBundleBucket.grantRead(documentRetrievalLambda);

    return documentRetrievalLambda;
  }
  private setupMockDirectDbClient(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    dbCluster: rds.DatabaseCluster;
    dbSecretArn: string;
  }): Lambda {
    const { lambdaLayers, vpc, envType, dbCluster, dbSecretArn } = ownProps;

    const mockDbClientLambda = createLambda({
      stack: this,
      name: "IHEGatewayV2MockDbClient",
      entry: "ihe-gateway-v2-mock-db-client",
      envType: envType,
      envVars: {
        DB_RESOURCE_ARN: dbCluster.clusterArn,
        DB_SECRET_ARN: dbSecretArn,
      },
      layers: [lambdaLayers.shared],
      memory: 1024,
      timeout: Duration.minutes(15),
      vpc,
    });

    dbCluster.grantDataApiAccess(mockDbClientLambda);
    return mockDbClientLambda;
  }

  private setupDocumentQueryLambda({
    props,
    version,
    lambdaLayers,
    vpc,
    secrets,
    medicalDocumentsBucket,
    posthogSecretName,
    alarmSnsAction,
    iheRequestsBucket,
  }: {
    props: EnvConfig;
    version: string | undefined;
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    secrets: Secrets;
    medicalDocumentsBucket: s3.IBucket;
    posthogSecretName: string | undefined;
    alarmSnsAction?: SnsAction | undefined;
    iheRequestsBucket: s3.IBucket;
  }): Lambda {
    const documentQueryLambda = createLambda({
      stack: this,
      name: "IHEInboundDocumentQueryV2",
      entry: "ihe-gateway-v2-inbound-document-query",
      layers: [lambdaLayers.shared],
      memory: 1024,
      envType: props.environmentType,
      envVars: {
        MEDICAL_DOCUMENTS_BUCKET_NAME: props.medicalDocumentsBucketName,
        IHE_REQUESTS_BUCKET_NAME: iheRequestsBucket.bucketName,
        API_URL: props.loadBalancerDnsName,
        ...(props.engineeringCxId ? { ENGINEERING_CX_ID: props.engineeringCxId } : {}),
        ...(posthogSecretName ? { POST_HOG_API_KEY_SECRET: posthogSecretName } : {}),
        ...(props.lambdasSentryDSN ? { SENTRY_DSN: props.lambdasSentryDSN } : {}),
      },
      vpc,
      alarmSnsAction,
      version,
    });

    iheRequestsBucket.grantReadWrite(documentQueryLambda);
    secrets[posthogSecretKey]?.grantRead(documentQueryLambda);
    medicalDocumentsBucket.grantReadWrite(documentQueryLambda);
    return documentQueryLambda;
  }

  private setupDocumentRetrievalLambda({
    props,
    version,
    lambdaLayers,
    vpc,
    secrets,
    medicalDocumentsBucket,
    posthogSecretName,
    alarmSnsAction,
    iheRequestsBucket,
  }: {
    props: EnvConfig;
    version: string | undefined;
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    secrets: Secrets;
    medicalDocumentsBucket: s3.IBucket;
    posthogSecretName: string | undefined;
    alarmSnsAction?: SnsAction | undefined;
    iheRequestsBucket: s3.IBucket;
  }): Lambda {
    const documentRetrievalLambda = createLambda({
      stack: this,
      name: "IHEInboundDocumentRetrievalV2",
      entry: "ihe-gateway-v2-inbound-document-retrieval",
      layers: [lambdaLayers.shared],
      memory: 1024,
      envType: props.environmentType,
      envVars: {
        IHE_REQUESTS_BUCKET_NAME: iheRequestsBucket.bucketName,
        MEDICAL_DOCUMENTS_BUCKET_NAME: props.medicalDocumentsBucketName,
        ...(props.engineeringCxId ? { ENGINEERING_CX_ID: props.engineeringCxId } : {}),
        ...(posthogSecretName ? { POST_HOG_API_KEY_SECRET: posthogSecretName } : {}),
        ...(props.lambdasSentryDSN ? { SENTRY_DSN: props.lambdasSentryDSN } : {}),
      },
      vpc,
      alarmSnsAction,
      version,
    });

    iheRequestsBucket.grantReadWrite(documentRetrievalLambda);
    secrets[posthogSecretKey]?.grantRead(documentRetrievalLambda);
    medicalDocumentsBucket.grantRead(documentRetrievalLambda);
    return documentRetrievalLambda;
  }

  private setupPatientDiscoveryLambda({
    props,
    version,
    lambdaLayers,
    vpc,
    secrets,
    posthogSecretName,
    alarmSnsAction,
    iheRequestsBucket,
    dbCluster,
    dbSecretArn,
  }: {
    props: EnvConfig;
    version: string | undefined;
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    secrets: Secrets;
    posthogSecretName: string | undefined;
    alarmSnsAction?: SnsAction | undefined;
    iheRequestsBucket: s3.IBucket;
    dbCluster: rds.DatabaseCluster;
    dbSecretArn: string;
  }): Lambda {
    const patientDiscoveryLambda = createLambda({
      stack: this,
      name: "IHEInboundPatientDiscoveryV2",
      entry: "ihe-gateway-v2-inbound-patient-discovery",
      layers: [lambdaLayers.shared],
      memory: 1024,
      envType: props.environmentType,
      envVars: {
        DB_RESOURCE_ARN: dbCluster.clusterArn,
        DB_SECRET_ARN: dbSecretArn,
        IHE_REQUESTS_BUCKET_NAME: iheRequestsBucket.bucketName,
        API_URL: props.loadBalancerDnsName,
        ...(props.engineeringCxId ? { ENGINEERING_CX_ID: props.engineeringCxId } : {}),
        ...(posthogSecretName ? { POST_HOG_API_KEY_SECRET: posthogSecretName } : {}),
        ...(props.lambdasSentryDSN ? { SENTRY_DSN: props.lambdasSentryDSN } : {}),
      },
      vpc,
      alarmSnsAction,
      version,
    });

    iheRequestsBucket.grantReadWrite(patientDiscoveryLambda);
    secrets[posthogSecretKey]?.grantRead(patientDiscoveryLambda);
    dbCluster.grantDataApiAccess(patientDiscoveryLambda);

    return patientDiscoveryLambda;
  }
}

function setupSlackNotifSnsTopic(stack: Stack, config: EnvConfig): SnsAction | undefined {
  if (!config.slack) return undefined;
  const topicArn = config.iheGateway?.snsTopicArn;
  if (!topicArn) throw new Error("Missing SNS topic ARN for IHE stack");

  const slackNotifSnsTopic = sns.Topic.fromTopicArn(stack, "SlackSnsTopic", topicArn);
  const alarmAction = new SnsAction(slackNotifSnsTopic);
  return alarmAction;
}
