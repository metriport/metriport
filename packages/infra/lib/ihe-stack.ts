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
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";

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

    // get the ownership Certificate. v2. TODO make it actual
    const ownershipCertificate = cert.Certificate.fromCertificateArn(
      this,
      "IHECertificate",
      props.config.iheGateway.certArn
    );

    const iheApiUrl = `${props.config.iheGateway?.subdomain}.${props.config.domain}`;

    // Create the API Gateway. v1
    const api = new apig.RestApi(this, "IHEAPIGateway", {
      description: "Metriport IHE Gateway",
      defaultCorsPreflightOptions: {
        allowOrigins: ["*"],
        allowHeaders: ["*"],
      },
      disableExecuteApiEndpoint: true,
    });

    // add domain cert + record + mTLS trust bundle
    api.addDomainName("IHEAPIDomain", {
      domainName: iheApiUrl,
      certificate: certificate,
      securityPolicy: apig.SecurityPolicy.TLS_1_2,
      mtls: {
        bucket: bucket,
        key: props.config.iheGateway?.trustStoreKey,
      },
    });

    // Create the API Gateway. v2
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

    // v2
    const apigw2 = new apigwv2.HttpApi(this, "IHEAPIGatewayv2", {
      // https://${dn.domainName}/foo goes to prodApi $default stage
      defaultDomainMapping: {
        domainName: domainName,
        mappingKey: "foo",
      },
      disableExecuteApiEndpoint: true,
    });

    // v1
    new r53.ARecord(this, "IHEAPIDomainRecord", {
      recordName: iheApiUrl,
      zone: publicZone,
      target: r53.RecordTarget.fromAlias(new r53_targets.ApiGateway(api)),
    });

    // v2
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

    // Create lambdas
    const xcaResource = api.root.addResource("xca");
    const xcpdResource = api.root.addResource("xcpd");

    // TODO 1377 When we have the IHE GW infra in place, let's update these so lambdas get triggered by the IHE GW instead of API GW
    const dqLambda = this.setupDocumentQueryLambda(
      props,
      lambdaLayers,
      xcaResource,
      vpc,
      alarmSnsAction
    );
    const drLambda = this.setupDocumentRetrievalLambda(
      props,
      lambdaLayers,
      xcaResource,
      vpc,
      alarmSnsAction
    );
    const pdLambda = this.setupPatientDiscoveryLambda(
      props,
      lambdaLayers,
      xcpdResource,
      vpc,
      alarmSnsAction
    );

    apigw2.addRoutes({
      path: "/xca",
      methods: [apigwv2.HttpMethod.ANY],
      integration: new HttpLambdaIntegration("xca/dq/v2", dqLambda),
    });
    apigw2.addRoutes({
      path: "/xca",
      methods: [apigwv2.HttpMethod.ANY],
      integration: new HttpLambdaIntegration("xca/dr/v2", drLambda),
    });

    apigw2.addRoutes({
      path: "/xcpd",
      methods: [apigwv2.HttpMethod.ANY],
      integration: new HttpLambdaIntegration("pd/v2", pdLambda),
    });

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
  ): Lambda {
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
    return documentQueryLambda;
  }

  private setupDocumentRetrievalLambda(
    props: IHEStackProps,
    lambdaLayers: LambdaLayers,
    xcaResource: apig.Resource,
    vpc: ec2.IVpc,
    alarmSnsAction?: SnsAction | undefined
  ): Lambda {
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
    return documentRetrievalLambda;
  }

  private setupPatientDiscoveryLambda(
    props: IHEStackProps,
    lambdaLayers: LambdaLayers,
    apiResource: apig.Resource,
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
        API_URL: `${props.config.subdomain}.${props.config.domain}`,
        ...(props.config.lambdasSentryDSN ? { SENTRY_DSN: props.config.lambdasSentryDSN } : {}),
      },
      vpc,
      alarmSnsAction,
      version: props.version,
    });

    apiResource.addMethod("ANY", new apig.LambdaIntegration(patientDiscoveryLambda));
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
