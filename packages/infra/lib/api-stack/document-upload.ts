import { IVpc } from "aws-cdk-lib/aws-ec2";
import { ILayerVersion, Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { S3EventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { createLambda as defaultCreateLambda } from "../shared/lambda";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import { EnvType } from "../env-type";

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
  vpc: IVpc;
  apiService: ecs_patterns.NetworkLoadBalancedFargateService;
  envType: EnvType;
  medicalDocumentsUploadBucket: s3.Bucket;
  medicalDocumentsBucket: s3.IBucket;
  sentryDsn: string | undefined;
  //   alarmSnsAction?: SnsAction;
}): Lambda {
  //   const config = getConfig();
  const documentUploadLambda = defaultCreateLambda({
    stack,
    name: "DocumentUpload",
    vpc,
    entry: "document-upload",
    layers: lambdaLayers,
    envVars: {
      ENV_TYPE: envType,
      API_URL: `http://${apiService.loadBalancer.loadBalancerDnsName}/internal/docs/doc-ref`,
      // MEDICAL_DOCUMENTS_UPLOAD_BUCKET_NAME: medicalDocumentUploadBucket.bucketName,
      ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
    },
  });

  medicalDocumentsUploadBucket.grantReadWrite(documentUploadLambda);
  medicalDocumentsBucket.grantReadWrite(documentUploadLambda);

  documentUploadLambda.addEventSource(
    new S3EventSource(medicalDocumentsUploadBucket, {
      events: [s3.EventType.OBJECT_CREATED],
    })
  );

  return documentUploadLambda;
}
