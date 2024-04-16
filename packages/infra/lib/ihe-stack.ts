import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as cert from "aws-cdk-lib/aws-certificatemanager";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import * as r53 from "aws-cdk-lib/aws-route53";
import * as r53_targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sns from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";
import { createIHEGateway } from "./ihe-stack/ihe-gateway";
import { createLambda } from "./shared/lambda";
import { LambdaLayers, setupLambdasLayers } from "./shared/lambda-layers";

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

    const documentQueryLambda = this.setupDocumentQueryLambda(
      props,
      lambdaLayers,
      vpc,
      medicalDocumentsBucket,
      alarmSnsAction
    );
    const documentRetrievalLambda = this.setupDocumentRetrievalLambda(
      props,
      lambdaLayers,
      vpc,
      medicalDocumentsBucket,
      alarmSnsAction
    );
    const patientDiscoveryLambda = this.setupPatientDiscoveryLambda(
      props,
      lambdaLayers,
      vpc,
      alarmSnsAction
    );

    createIHEGateway(this, {
      ...props,
      config: props.config,
      vpc,
      zoneName: props.config.host,
      apiGateway: apigw2,
      documentQueryLambda,
      documentRetrievalLambda,
      patientDiscoveryLambda,
      medicalDocumentsBucket,
      alarmAction: alarmSnsAction,
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

  private setupDocumentQueryLambda(
    props: IHEStackProps,
    lambdaLayers: LambdaLayers,
    vpc: ec2.IVpc,
    medicalDocumentsBucket: s3.IBucket,
    alarmSnsAction?: SnsAction | undefined
  ): Lambda {
    const documentQueryLambda = createLambda({
      stack: this,
      name: "IHEInboundDocumentQuery",
      entry: "ihe-inbound-document-query",
      layers: [lambdaLayers.shared],
      envType: props.config.environmentType,
      envVars: {
        MEDICAL_DOCUMENTS_BUCKET_NAME: props.config.medicalDocumentsBucketName,
        ...(props.config.lambdasSentryDSN ? { SENTRY_DSN: props.config.lambdasSentryDSN } : {}),
      },
      vpc,
      alarmSnsAction,
      version: props.version,
    });
    medicalDocumentsBucket.grantReadWrite(documentQueryLambda);
    return documentQueryLambda;
  }

  private setupDocumentRetrievalLambda(
    props: IHEStackProps,
    lambdaLayers: LambdaLayers,
    vpc: ec2.IVpc,
    medicalDocumentsBucket: s3.IBucket,
    alarmSnsAction?: SnsAction | undefined
  ): Lambda {
    const documentRetrievalLambda = createLambda({
      stack: this,
      name: "IHEInboundDocumentRetrieval",
      entry: "ihe-inbound-document-retrieval",
      layers: [lambdaLayers.shared],
      envType: props.config.environmentType,
      envVars: {
        MEDICAL_DOCUMENTS_BUCKET_NAME: props.config.medicalDocumentsBucketName,
        ...(props.config.lambdasSentryDSN ? { SENTRY_DSN: props.config.lambdasSentryDSN } : {}),
      },
      vpc,
      alarmSnsAction,
      version: props.version,
    });
    medicalDocumentsBucket.grantRead(documentRetrievalLambda);
    return documentRetrievalLambda;
  }

  private setupPatientDiscoveryLambda(
    props: IHEStackProps,
    lambdaLayers: LambdaLayers,
    vpc: ec2.IVpc,
    alarmSnsAction?: SnsAction | undefined
  ): Lambda {
    const patientDiscoveryLambda = createLambda({
      stack: this,
      name: "IHEInboundPatientDiscovery",
      entry: "ihe-inbound-patient-discovery",
      layers: [lambdaLayers.shared],
      envType: props.config.environmentType,
      envVars: {
        API_URL: props.config.loadBalancerDnsName,
        ...(props.config.lambdasSentryDSN ? { SENTRY_DSN: props.config.lambdasSentryDSN } : {}),
      },
      vpc,
      alarmSnsAction,
      version: props.version,
    });
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
