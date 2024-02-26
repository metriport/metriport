import { StackProps } from "aws-cdk-lib";
import * as apig from "aws-cdk-lib/aws-apigateway";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import * as r53 from "aws-cdk-lib/aws-route53";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
import { isProd } from "../shared/util";
import IHEDBConstruct from "./ihe-db-construct";
import IHEGatewayConstruct from "./ihe-gw-construct";

interface IHEGatewayProps extends StackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  zoneName: string;
  apiResource: apig.IResource;
  documentQueryLambda: Lambda;
  documentRetrievalLambda: Lambda;
  patientDiscoveryLambda: Lambda;
  medicalDocumentsBucket: IBucket;
  alarmAction?: SnsAction | undefined;
}

const name = "IHEGateway";

export function createIHEGateway(stack: Construct, props: IHEGatewayProps): void {
  const { config: mainConfig, apiResource } = props;

  const config = mainConfig.iheGateway;
  if (!config) throw new Error("Missing IHE Gateway config");

  const privateZone = r53.PrivateHostedZone.fromHostedZoneAttributes(stack, `${name}PrivateZone`, {
    hostedZoneId: config.privateZoneId,
    zoneName: mainConfig.host,
  });

  const db = new IHEDBConstruct(stack, {
    ...props,
    env: mainConfig.environmentType,
    config,
    privateZone,
    domain: mainConfig.domain,
  });

  const containerInsights = isProd(mainConfig) ? true : false;
  const cluster = new ecs.Cluster(stack, `${name}Cluster`, {
    vpc: props.vpc,
    containerInsights,
  });

  new IHEGatewayConstruct(stack, {
    ...props,
    mainConfig,
    config,
    cluster,
    privateZone,
    db,
    name: `${name}Outbound`,
    dnsSubdomain: "outbound",
    httpPorts: [
      config.outboundPorts.patientDiscovery,
      config.outboundPorts.documentQuery,
      config.outboundPorts.documentRetrieval,
    ],
  });
  const { serverAddress: iheGWAddressInbound } = new IHEGatewayConstruct(stack, {
    ...props,
    mainConfig,
    config,
    cluster,
    privateZone,
    db,
    name: `${name}Inbound`,
    dnsSubdomain: "inbound",
    httpPorts: [config.inboundPorts.patientDiscovery, config.inboundPorts.documentQuery],
  });

  const patientDiscoveryPort = config.inboundPorts.patientDiscovery;
  const documentQueryPort = config.inboundPorts.documentQuery;
  const documentRetrievalPort = config.inboundPorts.documentRetrieval ?? documentQueryPort;
  const buildInboundAddress = (port: number) => `http://${iheGWAddressInbound}:${port}`;

  const patientDiscoveryResource = apiResource.addResource("patient-discovery");
  proxyToServer(patientDiscoveryResource, buildInboundAddress(patientDiscoveryPort));

  const documentQueryResource = apiResource.addResource("document-query");
  proxyToServer(documentQueryResource, buildInboundAddress(documentQueryPort));

  const documentRetrievalResource = apiResource.addResource("document-retrieval");
  proxyToServer(documentRetrievalResource, buildInboundAddress(documentRetrievalPort));
}

function proxyToServer(resource: apig.Resource, serverAddress: string) {
  const httpIntegration = new apig.HttpIntegration(serverAddress, {
    proxy: true,
    httpMethod: "ANY",
  });
  resource.addMethod("ANY", httpIntegration);
}
