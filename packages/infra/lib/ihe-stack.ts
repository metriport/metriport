import { Stack, StackProps } from "aws-cdk-lib";
import { CfnOutput } from "aws-cdk-lib";
import * as cert from "aws-cdk-lib/aws-certificatemanager";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as r53 from "aws-cdk-lib/aws-route53";
import * as r53_targets from "aws-cdk-lib/aws-route53-targets";
import * as sns from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";
import { createLambda } from "./shared/lambda";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { LambdaLayers, setupLambdasLayers } from "./shared/lambda-layers";
import * as s3 from "aws-cdk-lib/aws-s3";
import { aws_wafv2 as wafv2 } from "aws-cdk-lib";
import { wafRules } from "./shared/waf-rules";
import * as cdk from "aws-cdk-lib";

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
    const ownershipCertificate = cert.Certificate.fromCertificateArn(
      this,
      "OwnershipVerificationCertificate",
      props.config.iheGateway.ownershipVerificationCertArn
    );

    // get the truststore bucket from S3
    const bucket = s3.Bucket.fromBucketName(
      this,
      "TruststoreBucket",
      props.config.iheGateway?.trustStoreBucketName
    );

    const iheApiUrl = `${props.config.iheGateway?.subdomain}.${props.config.domain}`;

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
        bucket: bucket,
        key: props.config.iheGateway?.trustStoreKey,
      },
      // this ownsership cert is the whole point of this entire migration.
      ownershipCertificate: ownershipCertificate,
      securityPolicy: apigwv2.SecurityPolicy.TLS_1_2,
    });

    const waf = new wafv2.CfnWebACL(this, "IHEGatewayWAF", {
      defaultAction: { allow: {} },
      scope: "REGIONAL",
      name: `IHEGatewayWAF`,
      rules: wafRules,
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `IHEGatewayWAF-Metric`,
        sampledRequestsEnabled: false,
      },
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

    const apiGatewayArn = cdk.Stack.of(this).formatArn({
      service: "apigateway",
      resource: "apis",
      resourceName: apigw2.httpApiId,
      region: cdk.Stack.of(this).region,
      account: cdk.Stack.of(this).account,
    });

    new wafv2.CfnWebACLAssociation(this, "APIWAFAssociation", {
      resourceArn: apiGatewayArn,
      webAclArn: waf.attrArn,
    });

    // commenting out so CFN deletes
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

    // TODO 1377 When we have the IHE GW infra in place, let's update these so lambdas get triggered by the IHE GW instead of API GW
    const dqLambda = this.setupDocumentQueryLambda(
      props,
      lambdaLayers,
      vpc,
      medicalDocumentsBucket,
      alarmSnsAction
    );
    const drLambda = this.setupDocumentRetrievalLambda(
      props,
      lambdaLayers,
      vpc,
      medicalDocumentsBucket,
      alarmSnsAction
    );
    const pdLambda = this.setupPatientDiscoveryLambda(props, lambdaLayers, vpc, alarmSnsAction);

    // v2
    apigw2.addRoutes({
      path: "/xca/dq",
      methods: [apigwv2.HttpMethod.ANY],
      integration: new HttpLambdaIntegration("dqIntegration", dqLambda),
    });
    apigw2.addRoutes({
      path: "/xca/dr",
      methods: [apigwv2.HttpMethod.ANY],
      integration: new HttpLambdaIntegration("drIntegration", drLambda),
    });

    apigw2.addRoutes({
      path: "/pd",
      methods: [apigwv2.HttpMethod.ANY],
      integration: new HttpLambdaIntegration("pdIntegration", pdLambda),
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
      name: "DocumentQuery",
      entry: "document-query",
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
      name: "DocumentRetrieval",
      entry: "document-retrieval",
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
      name: "PatientDiscovery",
      entry: "patient-discovery",
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
