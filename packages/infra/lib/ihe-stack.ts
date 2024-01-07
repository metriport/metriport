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
import { setupLambdasLayers, LambdaLayers } from "./shared/lambda-layers";

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

    // Create lambdas
    const xcaResource = api.root.addResource("xca");

    this.setupDocumentQueryLambda(props, lambdaLayers, xcaResource);
    this.setupDocumentRetrievalLambda(props, lambdaLayers, xcaResource);
    this.setupPatientDiscoveryLambda(props, lambdaLayers, api);

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

  // aws region, medical documents bucket name

  private setupDocumentQueryLambda(
    props: IHEStackProps,
    lambdaLayers: LambdaLayers,
    xcaResource: apig.Resource
  ) {
    const documentQueryLambda = createLambda({
      stack: this,
      name: "DocumentQuery",
      entry: "document-query",
      layers: [lambdaLayers.shared],
      envType: props.config.environmentType,
      envVars: {
        AWS_REGION: props.config.region,
        MEDICAL_DOCUMENTS_BUCKET_NAME: props.config.medicalDocumentsBucketName,
        ...(props.config.lambdasSentryDSN ? { SENTRY_DSN: props.config.lambdasSentryDSN } : {}),
      },
      vpc: props.vpc,
      alarmSnsAction: props.alarmAction,
    });

    const documentQueryResource = xcaResource.addResource("document-query");
    documentQueryResource.addMethod("ANY", new apig.LambdaIntegration(documentQueryLambda));
  }

  private setupDocumentRetrievalLambda(
    props: IHEStackProps,
    lambdaLayers: LambdaLayers,
    xcaResource: apig.Resource
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
      vpc: props.vpc,
      alarmSnsAction: props.alarmAction,
    });

    const documentRetrievalResource = xcaResource.addResource("document-retrieve");
    documentRetrievalResource.addMethod("ANY", new apig.LambdaIntegration(documentRetrievalLambda));
  }

  private setupPatientDiscoveryLambda(
    props: IHEStackProps,
    lambdaLayers: LambdaLayers,
    api: apig.RestApi
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
      vpc: props.vpc,
      alarmSnsAction: props.alarmAction,
    });

    const xcpdResource = api.root.addResource("xcpd");
    xcpdResource.addMethod("ANY", new apig.LambdaIntegration(patientDiscoveryLambda));
  }
}
