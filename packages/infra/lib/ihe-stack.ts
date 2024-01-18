import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cert from "aws-cdk-lib/aws-certificatemanager";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as r53 from "aws-cdk-lib/aws-route53";
import * as r53_targets from "aws-cdk-lib/aws-route53-targets";
import * as sns from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";
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

    // get the public zone
    const publicZone = r53.HostedZone.fromLookup(this, "Zone", {
      domainName: props.config.host,
    });

    // Create the API Gateway
    const api = new apig.RestApi(this, "IHEAPIGateway", {
      description: "Metriport IHE Gateway",
      defaultCorsPreflightOptions: {
        allowOrigins: ["*"],
        allowHeaders: ["*"],
      },
    });

    // get the certificate form ACM
    const certificate = cert.Certificate.fromCertificateArn(
      this,
      "IHECertificate",
      props.config.iheGateway.certArn
    );

    // get the truststore from S3
    const bucket = s3.Bucket.fromBucketName(
      this,
      "TruststoreBucket",
      props.config.iheGateway?.trustStoreBucketName
    );

    // add domain cert + record + mTLS trust bundle
    const iheApiUrl = `${props.config.iheGateway?.subdomain}.${props.config.domain}`;
    api.addDomainName("IHEAPIDomain", {
      domainName: iheApiUrl,
      certificate: certificate,
      securityPolicy: apig.SecurityPolicy.TLS_1_2,
      mtls: {
        bucket: bucket,
        key: props.config.iheGateway?.trustStoreKey,
      },
    });

    new r53.ARecord(this, "IHEAPIDomainRecord", {
      recordName: iheApiUrl,
      zone: publicZone,
      target: r53.RecordTarget.fromAlias(new r53_targets.ApiGateway(api)),
    });

    const lambdaLayers = setupLambdasLayers(this, true);

    const iheLambda = createLambda({
      stack: this,
      name: "IHE",
      entry: "ihe",
      layers: [lambdaLayers.shared],
      envType: props.config.environmentType,
      envVars: {
        ...(props.config.lambdasSentryDSN ? { SENTRY_DSN: props.config.lambdasSentryDSN } : {}),
      },
      vpc,
      alarmSnsAction,
    });

    const proxy = new apig.ProxyResource(this, `IHE/Proxy`, {
      parent: api.root,
      anyMethod: false,
      defaultCorsPreflightOptions: { allowOrigins: ["*"] },
    });
    proxy.addMethod("ANY", new apig.LambdaIntegration(iheLambda), {
      requestParameters: {
        "method.request.path.proxy": true,
      },
    });

    // Create lambdas
    const xcaResource = api.root.addResource("xca");
    const xcpdResource = api.root.addResource("xcpd");

    // TODO 1377 When we have the IHE GW infra in place, let's update these so lambdas get triggered by the IHE GW instead of API GW
    this.setupDocumentQueryLambda(props, lambdaLayers, xcaResource, vpc, alarmSnsAction);
    this.setupDocumentRetrievalLambda(props, lambdaLayers, xcaResource, vpc, alarmSnsAction);
    this.setupPatientDiscoveryLambda(props, lambdaLayers, xcpdResource, vpc, alarmSnsAction);

    //-------------------------------------------
    // Output
    //-------------------------------------------
    new CfnOutput(this, "IHEAPIGatewayUrl", {
      description: "IHE API Gateway URL",
      value: api.url,
    });
    new CfnOutput(this, "IHEAPIGatewayID", {
      description: "IHE API Gateway ID",
      value: api.restApiId,
    });
    new CfnOutput(this, "IHEAPIGatewayRootResourceID", {
      description: "IHE API Gateway Root Resource ID",
      value: api.root.resourceId,
    });
  }

  private setupDocumentQueryLambda(
    props: IHEStackProps,
    lambdaLayers: LambdaLayers,
    xcaResource: apig.Resource,
    vpc: ec2.IVpc,
    alarmSnsAction?: SnsAction | undefined
  ) {
    const documentQueryLambda = createLambda({
      stack: this,
      name: "DocumentQuery",
      entry: "document-query",
      layers: [lambdaLayers.shared],
      envType: props.config.environmentType,
      envVars: {
        ...(props.config.lambdasSentryDSN ? { SENTRY_DSN: props.config.lambdasSentryDSN } : {}),
      },
      vpc,
      alarmSnsAction,
      version: props.version,
    });

    const documentQueryResource = xcaResource.addResource("document-query");
    documentQueryResource.addMethod("ANY", new apig.LambdaIntegration(documentQueryLambda));
  }

  private setupDocumentRetrievalLambda(
    props: IHEStackProps,
    lambdaLayers: LambdaLayers,
    xcaResource: apig.Resource,
    vpc: ec2.IVpc,
    alarmSnsAction?: SnsAction | undefined
  ) {
    const documentRetrievalLambda = createLambda({
      stack: this,
      name: "DocumentRetrieval",
      entry: "document-retrieval",
      layers: [lambdaLayers.shared],
      envType: props.config.environmentType,
      envVars: {
        ...(props.config.lambdasSentryDSN ? { SENTRY_DSN: props.config.lambdasSentryDSN } : {}),
      },
      vpc,
      alarmSnsAction,
      version: props.version,
    });

    const documentRetrievalResource = xcaResource.addResource("document-retrieve");
    documentRetrievalResource.addMethod("ANY", new apig.LambdaIntegration(documentRetrievalLambda));
  }

  private setupPatientDiscoveryLambda(
    props: IHEStackProps,
    lambdaLayers: LambdaLayers,
    apiResource: apig.Resource,
    vpc: ec2.IVpc,
    alarmSnsAction?: SnsAction | undefined
  ) {
    const patientDiscoveryLambda = createLambda({
      stack: this,
      name: "PatientDiscovery",
      entry: "patient-discovery",
      layers: [lambdaLayers.shared],
      envType: props.config.environmentType,
      envVars: {
        API_URL: `${props.config.subdomain}.${props.config.domain}`,
        ...(props.config.lambdasSentryDSN ? { SENTRY_DSN: props.config.lambdasSentryDSN } : {}),
      },
      vpc,
      alarmSnsAction,
      version: props.version,
    });

    apiResource.addMethod("ANY", new apig.LambdaIntegration(patientDiscoveryLambda));
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
