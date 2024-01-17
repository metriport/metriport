import { StackProps } from "aws-cdk-lib";
import * as apig from "aws-cdk-lib/aws-apigateway";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import * as r53 from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
import IHEDBConstruct from "./ihe-db-construct";
import IHEGatewayConstruct from "./ihe-gw-construct";

interface IHEGatewayProps extends StackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  apiResource: apig.IResource;
  documentQueryLambda: Lambda;
  documentRetrievalLambda: Lambda;
  patientDiscoveryLambda: Lambda;
  alarmAction?: SnsAction | undefined;
}

const name = "IHEGateway";

// TODO move these parameters to object properties
export function createIHEGateway(stack: Construct, props: IHEGatewayProps): void {
  const { config: mainConfig, apiResource } = props;

  const config = mainConfig.iheGateway;
  if (!config) throw new Error("Missing IHE Gateway config");

  const privateZone = r53.PrivateHostedZone.fromHostedZoneId(
    stack,
    `${name}PrivateZone`,
    config.privateZoneId
  );

  const db = new IHEDBConstruct(stack, {
    ...props,
    config,
  });

  const { serverAddress: iheGWAddress } = new IHEGatewayConstruct(stack, {
    ...props,
    mainConfig,
    config,
    privateZone,
    db,
  });

  const buildAddress = (port: number) => `http://${iheGWAddress}:${port}`;

  const xcaResource = apiResource.addResource("xca");
  const documentQueryResource = xcaResource.addResource("document-query");
  proxyToServer(documentQueryResource, buildAddress(config.ports.documentQuery));
  const documentRetrievalResource = xcaResource.addResource("document-retrieve");
  proxyToServer(
    documentRetrievalResource,
    buildAddress(config.ports.documentRetrieve ?? config.ports.documentQuery)
  );

  const xcpdResource = apiResource.addResource("xcpd");
  proxyToServer(xcpdResource, buildAddress(config.ports.patientDiscovery));
}

function proxyToServer(resource: apig.Resource, serverAddress: string) {
  const httpIntegration = new apig.HttpIntegration(serverAddress, {
    proxy: true,
    httpMethod: "ANY",
  });
  resource.addMethod("ANY", httpIntegration);
}
