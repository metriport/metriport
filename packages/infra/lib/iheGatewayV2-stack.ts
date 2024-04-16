import { NestedStack, NestedStackProps } from "aws-cdk-lib";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { EnvType } from "./env-type";
import { LambdaLayers } from "./shared/lambda-layers";
import { Secrets } from "./shared/secrets";
import { createLambda } from "./shared/lambda";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Duration } from "aws-cdk-lib";
import { NetworkLoadBalancedFargateService } from "aws-cdk-lib/aws-ecs-patterns";

interface IHEGatewayV2LambdasNestedStackProps extends NestedStackProps {
  lambdaLayers: LambdaLayers;
  apiService: NetworkLoadBalancedFargateService;
  vpc: ec2.IVpc;
  secrets: Secrets;
  cqOrgCertificate: string | undefined;
  cqOrgPrivateKey: string | undefined;
  cqOrgPrivateKeyPassword: string | undefined;
  cqOrgCertificateIntermediate: string | undefined;
  apiURL: string;
  envType: EnvType;
  sentryDsn: string | undefined;
}

export class IHEGatewayV2LambdasNestedStack extends NestedStack {
  constructor(scope: Construct, id: string, props: IHEGatewayV2LambdasNestedStackProps) {
    super(scope, id, props);

    const patientDiscoveryLambda = this.setupIHEGatewayV2PatientDiscoveryLambda(props);
    const documentQueryLambda = this.setupIHEGatewayV2DocumentQueryLambda(props);
    const documentRetrievalLambda = this.setupIHEGatewayV2DocumentRetrievalLambda(props);

    // granting lambda invoke access to api service
    patientDiscoveryLambda.grantInvoke(props.apiService.taskDefinition.taskRole);
    documentQueryLambda.grantInvoke(props.apiService.taskDefinition.taskRole);
    documentRetrievalLambda.grantInvoke(props.apiService.taskDefinition.taskRole);
  }

  private setupIHEGatewayV2PatientDiscoveryLambda(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    apiService: NetworkLoadBalancedFargateService;
    secrets: Secrets;
    cqOrgCertificate: string | undefined;
    cqOrgPrivateKey: string | undefined;
    cqOrgPrivateKeyPassword: string | undefined;
    cqOrgCertificateIntermediate: string | undefined;
    apiURL: string;
    envType: EnvType;
    sentryDsn: string | undefined;
  }): Lambda {
    const {
      lambdaLayers,
      vpc,
      secrets,
      cqOrgCertificate,
      cqOrgPrivateKey,
      cqOrgPrivateKeyPassword,
      cqOrgCertificateIntermediate,
      apiURL,
      envType,
      sentryDsn,
    } = ownProps;

    const patientDiscoveryLambda = createLambda({
      stack: this,
      name: "IHEGatewayV2OutboundPatientDiscovery",
      entry: "iheGatewayV2-outbound-patient-discovery",
      envType: envType,
      envVars: {
        ...(cqOrgPrivateKey !== undefined && { CQ_ORG_PRIVATE_KEY: cqOrgPrivateKey }),
        ...(cqOrgCertificate !== undefined && { CQ_ORG_CERTIFICATE: cqOrgCertificate }),
        ...(cqOrgCertificateIntermediate !== undefined && {
          CQ_ORG_CERTIFICATE_INTERMEDIATE: cqOrgCertificateIntermediate,
        }),
        ...(cqOrgPrivateKeyPassword !== undefined && {
          CQ_ORG_PRIVATE_KEY_PASSWORD: cqOrgPrivateKeyPassword,
        }),
        API_URL: apiURL,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      memory: 512,
      timeout: Duration.minutes(5),
      vpc,
    });

    // granting secrets read access to lambda
    const cqOrgCertificateKey = "CQ_ORG_CERTIFICATE";
    if (!secrets[cqOrgCertificateKey]) {
      throw new Error(`${cqOrgCertificateKey} is not defined in config`);
    }
    secrets[cqOrgCertificateKey]?.grantRead(patientDiscoveryLambda);

    const cqOrgCertificateIntermediateKey = "CQ_ORG_CERTIFICATE_INTERMEDIATE";
    if (!secrets[cqOrgCertificateIntermediateKey]) {
      throw new Error(`${cqOrgCertificateIntermediateKey} is not defined in config`);
    }
    secrets[cqOrgCertificateIntermediateKey]?.grantRead(patientDiscoveryLambda);

    const cqOrgPrivateKeyKey = "CQ_ORG_PRIVATE_KEY";
    if (!secrets[cqOrgPrivateKeyKey]) {
      throw new Error(`${cqOrgPrivateKeyKey} is not defined in config`);
    }
    secrets[cqOrgPrivateKeyKey]?.grantRead(patientDiscoveryLambda);

    const cqOrgPrivateKeyPasswordKey = "CQ_ORG_PRIVATE_KEY_PASSWORD";
    if (!secrets[cqOrgPrivateKeyPasswordKey]) {
      throw new Error(`${cqOrgPrivateKeyPassword} is not defined in config`);
    }
    secrets[cqOrgPrivateKeyPasswordKey]?.grantRead(patientDiscoveryLambda);

    return patientDiscoveryLambda;
  }

  private setupIHEGatewayV2DocumentQueryLambda(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    secrets: Secrets;
    cqOrgCertificate: string | undefined;
    cqOrgPrivateKey: string | undefined;
    cqOrgPrivateKeyPassword: string | undefined;
    cqOrgCertificateIntermediate: string | undefined;
    apiURL: string;
    envType: EnvType;
    sentryDsn: string | undefined;
  }): Lambda {
    const {
      lambdaLayers,
      vpc,
      secrets,
      cqOrgCertificate,
      cqOrgPrivateKey,
      cqOrgPrivateKeyPassword,
      cqOrgCertificateIntermediate,
      apiURL,
      envType,
      sentryDsn,
    } = ownProps;

    const documentQueryLambda = createLambda({
      stack: this,
      name: "IHEGatewayV2OutboundDocumentQuery",
      entry: "iheGatewayV2-outbound-document-query",
      envType: envType,
      envVars: {
        ...(cqOrgPrivateKey !== undefined && { CQ_ORG_PRIVATE_KEY: cqOrgPrivateKey }),
        ...(cqOrgCertificate !== undefined && { CQ_ORG_CERTIFICATE: cqOrgCertificate }),
        ...(cqOrgCertificateIntermediate !== undefined && {
          CQ_ORG_CERTIFICATE_INTERMEDIATE: cqOrgCertificateIntermediate,
        }),
        ...(cqOrgPrivateKeyPassword !== undefined && {
          CQ_ORG_PRIVATE_KEY_PASSWORD: cqOrgPrivateKeyPassword,
        }),
        API_URL: apiURL,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      memory: 512,
      timeout: Duration.minutes(5),
      vpc,
    });

    // granting secrets read access to lambda
    const cqOrgCertificateKey = "CQ_ORG_CERTIFICATE";
    if (!secrets[cqOrgCertificateKey]) {
      throw new Error(`${cqOrgCertificateKey} is not defined in config`);
    }
    secrets[cqOrgCertificateKey]?.grantRead(documentQueryLambda);

    const cqOrgCertificateIntermediateKey = "CQ_ORG_CERTIFICATE_INTERMEDIATE";
    if (!secrets[cqOrgCertificateIntermediateKey]) {
      throw new Error(`${cqOrgCertificateIntermediateKey} is not defined in config`);
    }
    secrets[cqOrgCertificateIntermediateKey]?.grantRead(documentQueryLambda);

    const cqOrgPrivateKeyKey = "CQ_ORG_PRIVATE_KEY";
    if (!secrets[cqOrgPrivateKeyKey]) {
      throw new Error(`${cqOrgPrivateKeyKey} is not defined in config`);
    }
    secrets[cqOrgPrivateKeyKey]?.grantRead(documentQueryLambda);

    const cqOrgPrivateKeyPasswordKey = "CQ_ORG_PRIVATE_KEY_PASSWORD";
    if (!secrets[cqOrgPrivateKeyPasswordKey]) {
      throw new Error(`${cqOrgPrivateKeyPassword} is not defined in config`);
    }
    secrets[cqOrgPrivateKeyPasswordKey]?.grantRead(documentQueryLambda);

    return documentQueryLambda;
  }

  private setupIHEGatewayV2DocumentRetrievalLambda(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    secrets: Secrets;
    cqOrgCertificate: string | undefined;
    cqOrgPrivateKey: string | undefined;
    cqOrgPrivateKeyPassword: string | undefined;
    cqOrgCertificateIntermediate: string | undefined;
    apiURL: string;
    envType: EnvType;
    sentryDsn: string | undefined;
  }): Lambda {
    const {
      lambdaLayers,
      vpc,
      secrets,
      cqOrgCertificate,
      cqOrgPrivateKey,
      cqOrgPrivateKeyPassword,
      cqOrgCertificateIntermediate,
      apiURL,
      envType,
      sentryDsn,
    } = ownProps;

    const documentRetrievalLambda = createLambda({
      stack: this,
      name: "IHEGatewayV2OutboundDocumentRetrieval",
      entry: "iheGatewayV2-outbound-document-retrieval",
      envType: envType,
      envVars: {
        ...(cqOrgPrivateKey !== undefined && { CQ_ORG_PRIVATE_KEY: cqOrgPrivateKey }),
        ...(cqOrgCertificate !== undefined && { CQ_ORG_CERTIFICATE: cqOrgCertificate }),
        ...(cqOrgCertificateIntermediate !== undefined && {
          CQ_ORG_CERTIFICATE_INTERMEDIATE: cqOrgCertificateIntermediate,
        }),
        ...(cqOrgPrivateKeyPassword !== undefined && {
          CQ_ORG_PRIVATE_KEY_PASSWORD: cqOrgPrivateKeyPassword,
        }),
        API_URL: apiURL,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      memory: 512,
      timeout: Duration.minutes(5),
      vpc,
    });

    // granting secrets read access to lambda
    const cqOrgCertificateKey = "CQ_ORG_CERTIFICATE";
    if (!secrets[cqOrgCertificateKey]) {
      throw new Error(`${cqOrgCertificateKey} is not defined in config`);
    }
    secrets[cqOrgCertificateKey]?.grantRead(documentRetrievalLambda);

    const cqOrgCertificateIntermediateKey = "CQ_ORG_CERTIFICATE_INTERMEDIATE";
    if (!secrets[cqOrgCertificateIntermediateKey]) {
      throw new Error(`${cqOrgCertificateIntermediateKey} is not defined in config`);
    }
    secrets[cqOrgCertificateIntermediateKey]?.grantRead(documentRetrievalLambda);

    const cqOrgPrivateKeyKey = "CQ_ORG_PRIVATE_KEY";
    if (!secrets[cqOrgPrivateKeyKey]) {
      throw new Error(`${cqOrgPrivateKeyKey} is not defined in config`);
    }
    secrets[cqOrgPrivateKeyKey]?.grantRead(documentRetrievalLambda);

    const cqOrgPrivateKeyPasswordKey = "CQ_ORG_PRIVATE_KEY_PASSWORD";
    if (!secrets[cqOrgPrivateKeyPasswordKey]) {
      throw new Error(`${cqOrgPrivateKeyPassword} is not defined in config`);
    }
    secrets[cqOrgPrivateKeyPasswordKey]?.grantRead(documentRetrievalLambda);

    return documentRetrievalLambda;
  }
}
