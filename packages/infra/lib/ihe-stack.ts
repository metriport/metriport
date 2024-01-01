import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as cert from "aws-cdk-lib/aws-certificatemanager";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as r53 from "aws-cdk-lib/aws-route53";
import * as r53_targets from "aws-cdk-lib/aws-route53-targets";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";
import { createLambda } from "./shared/lambda";
import { setupLambdasLayers } from "./shared/lambda-layers";

interface IHEStackProps extends StackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  alarmAction: SnsAction | undefined;
}

export class IHEStack extends Stack {
  constructor(scope: Construct, id: string, props: IHEStackProps) {
    super(scope, id, props);
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

    // add domain cert + record
    const iheApiUrl = `${props.config.iheGateway?.subdomain}.${props.config.domain}`;
    api.addDomainName("IHEAPIDomain", {
      domainName: iheApiUrl,
      certificate: certificate,
      securityPolicy: apig.SecurityPolicy.TLS_1_2,
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
      vpc: props.vpc,
      alarmSnsAction: props.alarmAction,
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
}
