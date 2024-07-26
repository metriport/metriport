import { Duration, NestedStack, NestedStackProps, CfnOutput } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as apig from "aws-cdk-lib/aws-apigateway";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as r53_targets from "aws-cdk-lib/aws-route53-targets";

import { Construct } from "constructs";
import { LambdaLayers } from "./shared/lambda-layers";
import { Secrets } from "./shared/secrets";
import { EnvConfig } from "../config/env-config";
import { createLambda } from "./shared/lambda";
import { EnvType } from "./env-type";

interface EHRStackProps extends NestedStackProps {
  lambdaLayers: LambdaLayers;
  secrets: Secrets;
  vpc: ec2.IVpc;
  config: EnvConfig;
}

export class EHRStack extends NestedStack {
  constructor(scope: Construct, id: string, props: EHRStackProps) {
    super(scope, id, props);

    const sg = new ec2.SecurityGroup(this, "EhrSecurityGroup", {
      vpc: props.vpc,
      allowAllOutbound: true,
      securityGroupName: "EhrIntegrationVpcEndpoint",
    });

    const apiGatewayVpcEndpoint = new ec2.InterfaceVpcEndpoint(this, "EhrApiGatewayVpcEndpoint", {
      vpc: props.vpc,
      service: ec2.InterfaceVpcEndpointAwsService.APIGATEWAY,
      privateDnsEnabled: true,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [sg],
    });

    // https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-private-apis.html
    // https://gist.github.com/skorfmann/6941326b2dd75f52cb67e1853c5f8601

    const api = new apig.RestApi(this, "EhrApiGateway", {
      description: "Metriport EHR Webhook Gateway",
      defaultCorsPreflightOptions: {
        allowOrigins: ["*"],
        allowHeaders: ["*"],
      },
      endpointConfiguration: {
        types: [apig.EndpointType.PRIVATE],
        vpcEndpoints: [apiGatewayVpcEndpoint],
      },
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            principals: [new iam.AnyPrincipal()],
            actions: ["execute-api:Invoke"],
            resources: ["execute-api:/*"],
            effect: iam.Effect.ALLOW,
            conditions: {
              StringEquals: {
                "aws:SourceVpc": props.vpc.vpcId,
              },
            },
          }),
        ],
      }),
    });

    // Create a private hosted zone
    const privateHostedZone = new route53.PrivateHostedZone(this, "EhrPrivateHostedZone", {
      zoneName: "ehr.integrations.metriport.com",
      vpc: props.vpc,
    });

    const certificate = new acm.Certificate(this, "EhrApiCertificate", {
      domainName: "ehr.integrations.metriport.com",
      validation: acm.CertificateValidation.fromDns(privateHostedZone),
    });

    const customDomain = new apig.DomainName(this, "EhrCustomDomain", {
      domainName: "ehr.integrations.metriport.com",
      certificate: certificate,
      endpointType: apig.EndpointType.REGIONAL,
      securityPolicy: apig.SecurityPolicy.TLS_1_2,
    });

    new apig.BasePathMapping(this, "EhrApiMapping", {
      domainName: customDomain,
      restApi: api,
    });

    new route53.ARecord(this, "EhrApiAliasRecord", {
      zone: privateHostedZone,
      recordName: "ehr",
      target: route53.RecordTarget.fromAlias(new r53_targets.ApiGatewayDomain(customDomain)),
    });

    const canvasIntegrationLambda = this.setupCanvasIntergationLambda({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      secrets: props.secrets,
      envType: props.config.environmentType,
    });

    const resource = api.root.addResource("canvas");
    const integration = new apig.LambdaIntegration(canvasIntegrationLambda, {
      proxy: true,
    });

    resource.addMethod("POST", integration);

    // Output the API URL
    new CfnOutput(this, "ApiUrl", {
      value: api.url,
      description: "The URL of the private API Gateway",
    });
  }

  private setupCanvasIntergationLambda(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    secrets: Secrets;
    envType: EnvType;
  }): Lambda {
    const { lambdaLayers, vpc, envType } = ownProps;

    const canvasIntegrationLambda = createLambda({
      stack: this,
      name: "CanvasIntegration",
      entry: "canvas-integration",
      envType: envType,
      envVars: {},
      layers: [lambdaLayers.shared],
      memory: 1024,
      timeout: Duration.minutes(10),
      vpc,
    });

    return canvasIntegrationLambda;
  }
}
