import { CfnOutput, StackProps } from "aws-cdk-lib";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as cert from "aws-cdk-lib/aws-certificatemanager";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as r53 from "aws-cdk-lib/aws-route53";
import * as r53_targets from "aws-cdk-lib/aws-route53-targets";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";
import { createLambda } from "./shared/lambda";
import { LambdaLayers } from "./shared/lambda-layers";

interface IHEStackProps extends StackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  alarmAction: SnsAction | undefined;
  lambdaLayers: LambdaLayers;
  publicZone: r53.IHostedZone;
}

export function createIHEStack(stack: Construct, props: IHEStackProps) {
  //-------------------------------------------
  // API Gateway
  //-------------------------------------------
  if (!props.config.iheGateway?.subdomain) {
    throw new Error("Must define subdomainmain if building the IHE stack!");
  }

  if (!props.config.iheGateway?.certArn) {
    throw new Error("Must define cert arn if building the IHE stack!");
  }

  // Create the API Gateway
  const api = new apig.RestApi(stack, "IHEAPIGateway", {
    description: "Metriport IHE Gateway",
    defaultCorsPreflightOptions: {
      allowOrigins: ["*"],
      allowHeaders: ["*"],
    },
  });

  // get the certificate form ACM
  const certificate = cert.Certificate.fromCertificateArn(
    stack,
    "IHECertificate",
    props.config.iheGateway.certArn
  );

  // add domain cert + record
  const iheApiUrl = `${props.config.iheGateway?.subdomain}.${props.config.domain}`;
  api.addDomainName("IHEAPIDomain", {
    domainName: iheApiUrl,
    certificate: certificate,
    securityPolicy: apig.SecurityPolicy.TLS_1_2,
  });
  new r53.ARecord(stack, "IHEAPIDomainRecord", {
    recordName: iheApiUrl,
    zone: props.publicZone,
    target: r53.RecordTarget.fromAlias(new r53_targets.ApiGateway(api)),
  });

  const iheLambda = createLambda({
    stack: stack,
    name: "IHE",
    entry: "ihe",
    layers: [props.lambdaLayers.shared],
    envType: props.config.environmentType,
    envVars: {
      ...(props.config.lambdasSentryDSN ? { SENTRY_DSN: props.config.lambdasSentryDSN } : {}),
    },
    vpc: props.vpc,
    alarmSnsAction: props.alarmAction,
  });

  const proxy = new apig.ProxyResource(stack, `IHE/Proxy`, {
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
  const iti38Lambda = createLambda({
    stack: stack,
    name: "ITI38",
    entry: "iti38",
    layers: [props.lambdaLayers.shared],
    envType: props.config.environmentType,
    envVars: {
      ...(props.config.lambdasSentryDSN ? { SENTRY_DSN: props.config.lambdasSentryDSN } : {}),
    },
    vpc: props.vpc,
    alarmSnsAction: props.alarmAction,
  });

  const iti39Lambda = createLambda({
    stack: stack,
    name: "ITI39",
    entry: "iti39",
    layers: [props.lambdaLayers.shared],
    envType: props.config.environmentType,
    envVars: {
      ...(props.config.lambdasSentryDSN ? { SENTRY_DSN: props.config.lambdasSentryDSN } : {}),
    },
    vpc: props.vpc,
    alarmSnsAction: props.alarmAction,
  });

  const iti55Lambda = createLambda({
    stack: stack,
    name: "ITI55",
    entry: "iti55",
    layers: [props.lambdaLayers.shared],
    envType: props.config.environmentType,
    envVars: {
      ...(props.config.lambdasSentryDSN ? { SENTRY_DSN: props.config.lambdasSentryDSN } : {}),
    },
    vpc: props.vpc,
    alarmSnsAction: props.alarmAction,
  });

  // Create resources for each lambda directly under the API root
  const iti38Resource = api.root.addResource("ITI38");
  const iti39Resource = api.root.addResource("ITI39");
  const iti55Resource = api.root.addResource("ITI55");

  // Add methods for each resource
  iti38Resource.addMethod("ANY", new apig.LambdaIntegration(iti38Lambda));
  iti39Resource.addMethod("ANY", new apig.LambdaIntegration(iti39Lambda));
  iti55Resource.addMethod("ANY", new apig.LambdaIntegration(iti55Lambda));
  //-------------------------------------------
  // Output
  //-------------------------------------------
  new CfnOutput(stack, "IHEAPIGatewayUrl", {
    description: "IHE API Gateway URL",
    value: api.url,
  });
  new CfnOutput(stack, "IHEAPIGatewayID", {
    description: "IHE API Gateway ID",
    value: api.restApiId,
  });
  new CfnOutput(stack, "IHEAPIGatewayRootResourceID", {
    description: "IHE API Gateway Root Resource ID",
    value: api.root.resourceId,
  });
}
