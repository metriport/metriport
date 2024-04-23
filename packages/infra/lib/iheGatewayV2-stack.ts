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
  cqTrustBundleBucketName: string | undefined;
  medicalDocumentsBucketName: string;
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

  private grantSecretsReadAccess(
    lambdaFunction: Lambda,
    secrets: Secrets,
    secretKeys: string[]
  ): void {
    secretKeys.forEach(key => {
      if (!secrets[key]) {
        throw new Error(`${key} is not defined in config`);
      }
      secrets[key]?.grantRead(lambdaFunction);
    });
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
    cqTrustBundleBucketName: string | undefined;
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
      cqTrustBundleBucketName,
      apiURL,
      envType,
      sentryDsn,
    } = ownProps;

    const patientDiscoveryLambda = createLambda({
      stack: this,
      name: "IHEGatewayV2OutboundPatientDiscovery",
      entry: "ihe-gateway-v2-outbound-patient-discovery",
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
        ...(cqTrustBundleBucketName !== undefined && {
          CQ_TRUST_BUNDLE_BUCKET_NAME: cqTrustBundleBucketName,
        }),
        API_URL: apiURL,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      memory: 1024,
      timeout: Duration.minutes(5),
      vpc,
    });

    this.grantSecretsReadAccess(patientDiscoveryLambda, secrets, [
      "CQ_ORG_CERTIFICATE",
      "CQ_ORG_CERTIFICATE_INTERMEDIATE",
      "CQ_ORG_PRIVATE_KEY",
      "CQ_ORG_PRIVATE_KEY_PASSWORD",
    ]);

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
    cqTrustBundleBucketName: string | undefined;
    medicalDocumentsBucketName: string;
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
      cqTrustBundleBucketName,
      medicalDocumentsBucketName,
      apiURL,
      envType,
      sentryDsn,
    } = ownProps;

    const documentQueryLambda = createLambda({
      stack: this,
      name: "IHEGatewayV2OutboundDocumentQuery",
      entry: "ihe-gateway-v2-outbound-document-query",
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
        ...(cqTrustBundleBucketName !== undefined && {
          CQ_TRUST_BUNDLE_BUCKET_NAME: cqTrustBundleBucketName,
        }),
        API_URL: apiURL,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        MEDICAL_DOCUMENTS_BUCKET_NAME: medicalDocumentsBucketName,
      },
      layers: [lambdaLayers.shared],
      memory: 1024,
      timeout: Duration.minutes(5),
      vpc,
    });

    this.grantSecretsReadAccess(documentQueryLambda, secrets, [
      "CQ_ORG_CERTIFICATE",
      "CQ_ORG_CERTIFICATE_INTERMEDIATE",
      "CQ_ORG_PRIVATE_KEY",
      "CQ_ORG_PRIVATE_KEY_PASSWORD",
    ]);

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
    cqTrustBundleBucketName: string | undefined;
    medicalDocumentsBucketName: string;
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
      cqTrustBundleBucketName,
      medicalDocumentsBucketName,
      apiURL,
      envType,
      sentryDsn,
    } = ownProps;

    const documentRetrievalLambda = createLambda({
      stack: this,
      name: "IHEGatewayV2OutboundDocumentRetrieval",
      entry: "ihe-gateway-v2-outbound-document-retrieval",
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
        ...(cqTrustBundleBucketName !== undefined && {
          CQ_TRUST_BUNDLE_BUCKET_NAME: cqTrustBundleBucketName,
        }),
        API_URL: apiURL,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        MEDICAL_DOCUMENTS_BUCKET_NAME: medicalDocumentsBucketName,
      },
      layers: [lambdaLayers.shared],
      memory: 1024,
      timeout: Duration.minutes(5),
      vpc,
    });

    this.grantSecretsReadAccess(documentRetrievalLambda, secrets, [
      "CQ_ORG_CERTIFICATE",
      "CQ_ORG_CERTIFICATE_INTERMEDIATE",
      "CQ_ORG_PRIVATE_KEY",
      "CQ_ORG_PRIVATE_KEY_PASSWORD",
    ]);

    return documentRetrievalLambda;
  }
}
