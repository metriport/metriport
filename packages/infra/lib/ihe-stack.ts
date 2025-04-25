import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import { CfnStage } from "aws-cdk-lib/aws-apigatewayv2";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cert from "aws-cdk-lib/aws-certificatemanager";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as r53 from "aws-cdk-lib/aws-route53";
import * as r53_targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sns from "aws-cdk-lib/aws-sns";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";
import { createLambda } from "./shared/lambda";
import { LambdaLayers, setupLambdasLayers } from "./shared/lambda-layers";
import { getSecrets, Secrets } from "./shared/secrets";

const posthogSecretKey = "POST_HOG_API_KEY_SECRET";
interface IHEStackProps extends StackProps {
  config: EnvConfig;
  version: string | undefined;
}

export class IHEStack extends Stack {
  constructor(scope: Construct, id: string, props: IHEStackProps) {
    super(scope, id, props);

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

    if (!props.config.iheGateway.ownershipCertArn) {
      throw new Error("Missing ownership certificate ARN for IHE stack");
    }
    // get the ownership Certificate from ACM.
    const ownershipCertificate = cert.Certificate.fromCertificateArn(
      this,
      "OwnershipVerificationCertificate",
      props.config.iheGateway.ownershipCertArn
    );

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

    const lambdaLayers = setupLambdasLayers(this, true);

    const posthogSecretName = props.config.analyticsSecretNames.POST_HOG_API_KEY_SECRET;

    const iheRequestsBucket = s3.Bucket.fromBucketName(
      this,
      "IHERequestsBucket",
      props.config.iheRequestsBucketName
    );

    const patientDiscoveryLambdaV2 = this.setupPatientDiscoveryLambda({
      props,
      lambdaLayers,
      vpc,
      secrets,
      posthogSecretName,
      alarmSnsAction,
      iheRequestsBucket,
    });

    const documentQueryLambdaV2 = this.setupDocumentQueryLambda({
      props,
      lambdaLayers,
      vpc,
      secrets,
      medicalDocumentsBucket,
      posthogSecretName,
      alarmSnsAction,
      iheRequestsBucket,
    });

    const documentRetrievalLambdaV2 = this.setupDocumentRetrievalLambda({
      props,
      lambdaLayers,
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

    //-------------------------------------------
    // Output
    //-------------------------------------------
    new CfnOutput(this, "IHEAPIGatewayID", {
      description: "IHE API Gateway ID",
      value: apigw2.apiId,
    });
    new CfnOutput(this, "IHEAPIGatewayRootResourceID", {
      description: "IHE API Gateway HTTP API ID",
      value: apigw2.httpApiId,
    });
  }

  private setupDocumentQueryLambda({
    props,
    lambdaLayers,
    vpc,
    secrets,
    medicalDocumentsBucket,
    posthogSecretName,
    alarmSnsAction,
    iheRequestsBucket,
  }: {
    props: IHEStackProps;
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
      envType: props.config.environmentType,
      envVars: {
        MEDICAL_DOCUMENTS_BUCKET_NAME: props.config.medicalDocumentsBucketName,
        IHE_REQUESTS_BUCKET_NAME: iheRequestsBucket.bucketName,
        API_LB_ADDRESS: props.config.loadBalancerDnsName,
        ...(props.config.engineeringCxId
          ? { ENGINEERING_CX_ID: props.config.engineeringCxId }
          : {}),
        ...(posthogSecretName ? { POST_HOG_API_KEY_SECRET: posthogSecretName } : {}),
        ...(props.config.lambdasSentryDSN ? { SENTRY_DSN: props.config.lambdasSentryDSN } : {}),
      },
      vpc,
      alarmSnsAction,
      version: props.version,
    });

    iheRequestsBucket.grantReadWrite(documentQueryLambda);
    secrets[posthogSecretKey]?.grantRead(documentQueryLambda);
    medicalDocumentsBucket.grantReadWrite(documentQueryLambda);
    return documentQueryLambda;
  }

  private setupDocumentRetrievalLambda({
    props,
    lambdaLayers,
    vpc,
    secrets,
    medicalDocumentsBucket,
    posthogSecretName,
    alarmSnsAction,
    iheRequestsBucket,
  }: {
    props: IHEStackProps;
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
      envType: props.config.environmentType,
      envVars: {
        IHE_REQUESTS_BUCKET_NAME: iheRequestsBucket.bucketName,
        MEDICAL_DOCUMENTS_BUCKET_NAME: props.config.medicalDocumentsBucketName,
        ...(props.config.engineeringCxId
          ? { ENGINEERING_CX_ID: props.config.engineeringCxId }
          : {}),
        ...(posthogSecretName ? { POST_HOG_API_KEY_SECRET: posthogSecretName } : {}),
        ...(props.config.lambdasSentryDSN ? { SENTRY_DSN: props.config.lambdasSentryDSN } : {}),
      },
      vpc,
      alarmSnsAction,
      version: props.version,
    });

    iheRequestsBucket.grantReadWrite(documentRetrievalLambda);
    secrets[posthogSecretKey]?.grantRead(documentRetrievalLambda);
    medicalDocumentsBucket.grantRead(documentRetrievalLambda);
    return documentRetrievalLambda;
  }

  private setupPatientDiscoveryLambda({
    props,
    lambdaLayers,
    vpc,
    secrets,
    posthogSecretName,
    alarmSnsAction,
    iheRequestsBucket,
  }: {
    props: IHEStackProps;
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    secrets: Secrets;
    posthogSecretName: string | undefined;
    alarmSnsAction?: SnsAction | undefined;
    iheRequestsBucket: s3.IBucket;
  }): Lambda {
    const patientDiscoveryLambda = createLambda({
      stack: this,
      name: "IHEInboundPatientDiscoveryV2",
      entry: "ihe-gateway-v2-inbound-patient-discovery",
      layers: [lambdaLayers.shared],
      memory: 1024,
      envType: props.config.environmentType,
      envVars: {
        IHE_REQUESTS_BUCKET_NAME: iheRequestsBucket.bucketName,
        API_URL: props.config.loadBalancerDnsName,
        ...(props.config.engineeringCxId
          ? { ENGINEERING_CX_ID: props.config.engineeringCxId }
          : {}),
        ...(posthogSecretName ? { POST_HOG_API_KEY_SECRET: posthogSecretName } : {}),
        ...(props.config.lambdasSentryDSN ? { SENTRY_DSN: props.config.lambdasSentryDSN } : {}),
      },
      vpc,
      alarmSnsAction,
      version: props.version,
    });

    iheRequestsBucket.grantReadWrite(patientDiscoveryLambda);
    secrets[posthogSecretKey]?.grantRead(patientDiscoveryLambda);

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
