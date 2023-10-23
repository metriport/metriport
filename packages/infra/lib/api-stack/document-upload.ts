import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import { ILayerVersion } from "aws-cdk-lib/aws-lambda";
import { S3EventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { EnvType } from "../env-type";
import { createLambda as defaultCreateLambda } from "../shared/lambda";

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
  lambdaLayers: ILayerVersion[];
  stack: Construct;
  vpc: ec2.IVpc;
  apiService: ecs_patterns.NetworkLoadBalancedFargateService;
  envType: EnvType;
  medicalDocumentsUploadBucket: s3.Bucket;
  medicalDocumentsBucket: s3.IBucket;
  sentryDsn: string | undefined;
  //   alarmSnsAction?: SnsAction;
}) {
  //   const config = getConfig();
  const documentUploaderLambda = defaultCreateLambda({
    stack,
    name: "DocumentUploaderTest",
    vpc,
    entry: "document-uploader",
    layers: lambdaLayers,
    envVars: {
      ENV_TYPE: envType,
      API_URL: `http://${apiService.loadBalancer.loadBalancerDnsName}/internal/docs/doc-ref`,
      // MEDICAL_DOCUMENTS_UPLOAD_BUCKET_NAME: medicalDocumentUploadBucket.bucketName,
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
