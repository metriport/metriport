import { NestedStack, NestedStackProps } from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { EnvType } from "./env-type";
import { LambdaLayers } from "./shared/lambda-layers";
import { Secrets } from "./shared/secrets";
import { createLambda } from "./shared/lambda";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Duration } from "aws-cdk-lib";
import { NetworkLoadBalancedFargateService } from "aws-cdk-lib/aws-ecs-patterns";
import { FilterPattern } from "aws-cdk-lib/aws-logs";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";

const whitespaceRegex = /\s+/g;

interface IHEGatewayV2LambdasNestedStackProps extends NestedStackProps {
  lambdaLayers: LambdaLayers;
  apiService: NetworkLoadBalancedFargateService;
  vpc: ec2.IVpc;
  secrets: Secrets;
  cqOrgCertificate: string | undefined;
  cqOrgPrivateKey: string | undefined;
  cqOrgPrivateKeyPassword: string | undefined;
  cqOrgCertificateIntermediate: string | undefined;
  cqTrustBundleBucket: s3.IBucket;
  medicalDocumentsBucket: s3.Bucket;
  apiURL: string;
  envType: EnvType;
  sentryDsn: string | undefined;
  alarmSnsAction?: SnsAction;
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

    this.addMetricFiltersAndAlarms(patientDiscoveryLambda, "PatientDiscoveryLambda", props, [
      { filterPattern: "Aborted Error In Soap Response", threshold: 100 },
      { filterPattern: "Failure Sending SAML Request", threshold: 100 },
    ]);

    this.addMetricFiltersAndAlarms(documentQueryLambda, "DocumentQueryLambda", props, [
      { filterPattern: "RegistryErrorList In Soap Response", threshold: 5 },
      { filterPattern: "Failure Sending SAML Request", threshold: 5 },
    ]);

    this.addMetricFiltersAndAlarms(documentRetrievalLambda, "DocumentRetrievalLambda", props, [
      { filterPattern: "RegistryErrorList In Soap Response", threshold: 5 },
      { filterPattern: "Failure Sending SAML Request", threshold: 5 },
    ]);
  }

  private addMetricFiltersAndAlarms(
    lambdaFunction: Lambda,
    functionName: string,
    props: IHEGatewayV2LambdasNestedStackProps,
    filters: { filterPattern: string; threshold: number }[]
  ) {
    const logGroup = lambdaFunction.logGroup;

    filters.forEach(({ filterPattern, threshold }) => {
      const sanitizedFilterPattern = filterPattern.replace(whitespaceRegex, "");
      const metricFilter = logGroup.addMetricFilter(
        `${functionName}-${sanitizedFilterPattern}-MetricFilter`,
        {
          metricNamespace: "IHEGatewayV2",
          metricName: `${functionName}-${sanitizedFilterPattern}`,
          filterPattern: FilterPattern.anyTerm(filterPattern),
          metricValue: "1",
        }
      );

      const alarm = metricFilter
        .metric()
        .createAlarm(this, `${functionName}-${sanitizedFilterPattern}-Alarm`, {
          threshold,
          evaluationPeriods: 1,
          alarmDescription: `Alarm if ${functionName} encounters ${filterPattern}`,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });

      props.alarmSnsAction && alarm.addAlarmAction(props.alarmSnsAction);
    });
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
    medicalDocumentsBucket: s3.Bucket;
    cqTrustBundleBucket: s3.IBucket;
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
      medicalDocumentsBucket,
      cqTrustBundleBucket,
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
        ...(cqTrustBundleBucket !== undefined && {
          CQ_TRUST_BUNDLE_BUCKET_NAME: cqTrustBundleBucket.bucketName,
        }),
        API_URL: apiURL,
        MEDICAL_DOCUMENTS_BUCKET_NAME: medicalDocumentsBucket.bucketName,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      memory: 4096,
      timeout: Duration.minutes(5),
      vpc,
    });

    this.grantSecretsReadAccess(patientDiscoveryLambda, secrets, [
      "CQ_ORG_CERTIFICATE",
      "CQ_ORG_CERTIFICATE_INTERMEDIATE",
      "CQ_ORG_PRIVATE_KEY",
      "CQ_ORG_PRIVATE_KEY_PASSWORD",
    ]);

    medicalDocumentsBucket.grantRead(patientDiscoveryLambda);
    cqTrustBundleBucket.grantRead(patientDiscoveryLambda);
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
    cqTrustBundleBucket: s3.IBucket;
    medicalDocumentsBucket: s3.Bucket;
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
      cqTrustBundleBucket,
      medicalDocumentsBucket,
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
        ...(cqTrustBundleBucket !== undefined && {
          CQ_TRUST_BUNDLE_BUCKET_NAME: cqTrustBundleBucket.bucketName,
        }),
        API_URL: apiURL,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        MEDICAL_DOCUMENTS_BUCKET_NAME: medicalDocumentsBucket.bucketName,
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

    medicalDocumentsBucket.grantRead(documentQueryLambda);
    cqTrustBundleBucket.grantRead(documentQueryLambda);

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
    cqTrustBundleBucket: s3.IBucket;
    medicalDocumentsBucket: s3.Bucket;
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
      cqTrustBundleBucket,
      medicalDocumentsBucket,
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
        ...(cqTrustBundleBucket !== undefined && {
          CQ_TRUST_BUNDLE_BUCKET_NAME: cqTrustBundleBucket.bucketName,
        }),
        API_URL: apiURL,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        MEDICAL_DOCUMENTS_BUCKET_NAME: medicalDocumentsBucket.bucketName,
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

    medicalDocumentsBucket.grantReadWrite(documentRetrievalLambda);
    cqTrustBundleBucket.grantRead(documentRetrievalLambda);

    return documentRetrievalLambda;
  }
}
