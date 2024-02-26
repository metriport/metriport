import { StackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import * as r53 from "aws-cdk-lib/aws-route53";
import { IBucket } from "aws-cdk-lib/aws-s3";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpUrlIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
import { isProd } from "../shared/util";
import IHEDBConstruct from "./ihe-db-construct";
import IHEGatewayConstruct from "./ihe-gw-construct";

interface IHEGatewayProps extends StackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  zoneName: string;
  apiGateway: apigwv2.HttpApi;
  documentQueryLambda: Lambda;
  documentRetrievalLambda: Lambda;
  patientDiscoveryLambda: Lambda;
  medicalDocumentsBucket: IBucket;
  alarmAction?: SnsAction | undefined;
}

const name = "IHEGateway";
const portOutboundPD = 8082;
const portOutboundDQ = 8084;
const portOutboundDR = 8086;
const portInboundPD = 9091;
const portInboundDQ = 9092;

export function createIHEGateway(stack: Construct, props: IHEGatewayProps): void {
  const { config: mainConfig, apiGateway } = props;

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
    httpPorts: [portOutboundPD, portOutboundDQ, portOutboundDR],
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
    httpPorts: [portInboundPD, portInboundDQ],
  });

  const patientDiscoveryPort = config.inboundPorts.patientDiscovery;
  const documentQueryPort = config.inboundPorts.documentQuery;
  const documentRetrievalPort = config.inboundPorts.documentRetrieval ?? documentQueryPort;
  const buildInboundAddress = (port: number) => `http://${iheGWAddressInbound}:${port}`;

  addProxyRoute("v1/patient-discovery", buildInboundAddress(patientDiscoveryPort), apiGateway);
  addProxyRoute("v1/document-query", buildInboundAddress(documentQueryPort), apiGateway);
  addProxyRoute("v1/document-retrieval", buildInboundAddress(documentRetrievalPort), apiGateway);
}

function addProxyRoute(path: string, serverAddress: string, apiGateway: apigwv2.HttpApi) {
  const integration = new HttpUrlIntegration(`${path}Integration`, serverAddress, {
    method: apigwv2.HttpMethod.ANY, // Assuming you want to proxy any HTTP method
  });
  apiGateway.addRoutes({
    path,
    methods: [apigwv2.HttpMethod.ANY],
    integration,
  });
}
