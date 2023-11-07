import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import { S3EventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { EnvType } from "../env-type";
import { createLambda as defaultCreateLambda } from "../shared/lambda";
import { LambdaLayers } from "../shared/lambda-layers";

export function createLambda({
  lambdaLayers,
  stack,
  vpc,
  apiService,
  envType,
  medicalDocumentsUploadBucket,
  medicalDocumentsBucket,
  sentryDsn,
}: {
  lambdaLayers: LambdaLayers;
  stack: Construct;
  vpc: ec2.IVpc;
  apiService: ecs_patterns.NetworkLoadBalancedFargateService;
  envType: EnvType;
  medicalDocumentsBucket: s3.IBucket;
  medicalDocumentsUploadBucket: s3.Bucket;
  sentryDsn: string | undefined;
}) {
  const documentUploaderLambda = defaultCreateLambda({
    stack,
    name: "DocumentUploader",
    vpc,
    entry: "document-uploader",
    layers: [lambdaLayers.shared],
    envType,
    envVars: {
      API_URL: `http://${apiService.loadBalancer.loadBalancerDnsName}`,
      MEDICAL_DOCUMENTS_DESTINATION_BUCKET: medicalDocumentsBucket.bucketName,
      ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
    },
  });

  medicalDocumentsUploadBucket.grantReadWrite(documentUploaderLambda);
  medicalDocumentsBucket.grantReadWrite(documentUploaderLambda);

  documentUploaderLambda.addEventSource(
    new S3EventSource(medicalDocumentsUploadBucket, {
      events: [s3.EventType.OBJECT_CREATED],
    })
  );
}
