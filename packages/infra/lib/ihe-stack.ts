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
  if (!props.config.ihe.iheSubdomain) {
    throw new Error("Must define iheSubdomain if building the IHE stack!");
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
    props.config.ihe.CERT_ARN
  );

  // add domain cert + record
  const iheApiUrl = `${props.config.ihe.iheSubdomain}.${props.config.domain}`;
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

  // create the proxy to the lambda
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
