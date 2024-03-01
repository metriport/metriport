import { StackProps } from "aws-cdk-lib";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpAlbIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
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
  apiGateway: apigwv2.HttpApi;
  documentQueryLambda: Lambda;
  documentRetrievalLambda: Lambda;
  patientDiscoveryLambda: Lambda;
  medicalDocumentsBucket: IBucket;
  alarmAction?: SnsAction | undefined;
}

const name = "IHEGateway";

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
    pdPort: config.outboundPorts.patientDiscovery,
    dqPort: config.outboundPorts.documentQuery,
    drPort: config.outboundPorts.documentRetrieval,
  });
  const { pdListener, dqListener, drListener } = new IHEGatewayConstruct(stack, {
    ...props,
    mainConfig,
    config,
    cluster,
    privateZone,
    db,
    name: `${name}Inbound`,
    dnsSubdomain: "inbound",
    pdPort: config.inboundPorts.patientDiscovery,
    dqPort: config.inboundPorts.documentQuery,
    drPort: config.inboundPorts.documentRetrieval ?? config.inboundPorts.documentQuery,
  });

  // setup a private link so the API GW can talk to the ALB
  const vpcLink = new apigwv2.VpcLink(stack, "IHEAPIGWVPCLink", {
    vpc: props.vpc,
  });

  apiGateway.addRoutes({
    path: "/v1/patient-discovery",
    integration: new HttpAlbIntegration(`IHEGWPDIntegration`, pdListener, {
      vpcLink,
      parameterMapping: new apigwv2.ParameterMapping().overwritePath(
        apigwv2.MappingValue.custom(
          "/Gateway/PatientDiscovery/1_0/NhinService/NhinPatientDiscovery?wsdl"
        )
      ),
    }),
  });
  apiGateway.addRoutes({
    path: "/v1/document-query",
    integration: new HttpAlbIntegration(`IHEGWDQIntegration`, dqListener, {
      vpcLink,
      parameterMapping: new apigwv2.ParameterMapping().overwritePath(
        apigwv2.MappingValue.custom(
          "/Gateway/DocumentQuery/3_0/NhinService/RespondingGateway_Query_Service/DocQuery"
        )
      ),
    }),
  });
  apiGateway.addRoutes({
    path: "/v1/document-retrieval",
    integration: new HttpAlbIntegration(`IHEGWDQIntegration`, drListener, {
      vpcLink,
      parameterMapping: new apigwv2.ParameterMapping().overwritePath(
        apigwv2.MappingValue.custom(
          "/Gateway/DocumentRetrieve/3_0/NhinService/RespondingGateway_Retrieve_Service/DocRetrieve"
        )
      ),
    }),
  });
}
