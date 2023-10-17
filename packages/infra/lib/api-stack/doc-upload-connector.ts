// import { Duration } from "aws-cdk-lib";
// import { IVpc } from "aws-cdk-lib/aws-ec2";
// import { ILayerVersion, Function as Lambda } from "aws-cdk-lib/aws-lambda";
// import { S3EventSource } from "aws-cdk-lib/aws-lambda-event-sources";
// import * as s3 from "aws-cdk-lib/aws-s3";
// import { Construct } from "constructs";
// import { EnvType } from "../env-type";
// import { getConfig } from "../shared/config";
// import { createLambda as defaultCreateLambda } from "../shared/lambda";
// import { settings as settingsFhirConverter } from "./fhir-converter-service";

// function settings() {
//   const {
//     cpuAmount: fhirConverterCPUAmount,
//     taskCountMin: fhirConverterTaskCounMin,
//     maxExecutionTimeout,
//   } = settingsFhirConverter();

//   const lambdaTimeout = maxExecutionTimeout.minus(Duration.seconds(5));
//   return {
//     connectorName: "DocumentUpload",
//     lambdaMemory: 512,
//     // Number of messages the lambda pull from SQS at once
//     lambdaBatchSize: 1,
//     // Max number of concurrent instances of the lambda that an Amazon SQS event source can invoke [2 - 1000].
//     maxConcurrency: fhirConverterCPUAmount * fhirConverterTaskCounMin,
//     // How long can the lambda run for, max is 900 seconds (15 minutes)
//     lambdaTimeout,
//     // How long will it take before Axios returns a timeout error - should be less than the lambda timeout
//     axiosTimeout: lambdaTimeout.minus(Duration.seconds(5)), // give the lambda some time to deal with the timeout
//     // Number of times we want to retry a message, this includes throttles!
//     maxReceiveCount: 5,
//     // Number of times we want to retry a message that timed out when trying to be processed
//     maxTimeoutRetries: 99,
//     // How long messages should be invisible for other consumers, based on the lambda timeout
//     // We don't care if the message gets reprocessed, so no need to have a huge visibility timeout that makes it harder to move messages to the DLQ
//     visibilityTimeout: Duration.seconds(lambdaTimeout.toSeconds() * 2 + 1),
//     delayWhenRetrying: Duration.seconds(10),
//   };
// }

// export function createLambda({
//   lambdaLayers,
//   envType,
//   stack,
//   vpc,
//   medicalDocumentUploadBucket,
//   devsTestBucket,
//   apiUrl,
// }: // apiServiceDnsAddress,
// {
//   lambdaLayers: ILayerVersion[];
//   envType: EnvType;
//   stack: Construct;
//   vpc: IVpc;
//   medicalDocumentUploadBucket: s3.Bucket;
//   devsTestBucket: s3.IBucket;
//   apiUrl: string;
//   // apiServiceDnsAddress?: string;
// }): Lambda {
//   const config = getConfig();
//   const {
//     connectorName,
//     lambdaMemory,
//     lambdaTimeout,
//     axiosTimeout,
//     maxTimeoutRetries,
//     delayWhenRetrying,
//   } = settings();
//   const uploadedDocumentProcessorLambda = defaultCreateLambda({
//     stack,
//     name: connectorName,
//     vpc,
//     subnets: vpc.privateSubnets,
//     entry: "uploaded-document-processor",
//     layers: lambdaLayers,
//     memory: lambdaMemory,
//     envVars: {
//       ENV_TYPE: envType,
//       AXIOS_TIMEOUT_SECONDS: axiosTimeout.toSeconds().toString(),
//       MAX_TIMEOUT_RETRIES: String(maxTimeoutRetries),
//       // MEDICAL_DOCUMENTS_UPLOAD_BUCKET_NAME: medicalDocumentUploadBucket.bucketName,
//       DELAY_WHEN_RETRY_SECONDS: delayWhenRetrying.toSeconds().toString(),
//       ...(config.lambdasSentryDSN ? { SENTRY_DSN: config.lambdasSentryDSN } : {}),
//       API_URL: apiUrl,
//     },
//     timeout: lambdaTimeout,
//   });

//   medicalDocumentUploadBucket.grantReadWrite(uploadedDocumentProcessorLambda);
//   devsTestBucket.grantReadWrite(uploadedDocumentProcessorLambda);

//   uploadedDocumentProcessorLambda.addEventSource(
//     new S3EventSource(medicalDocumentUploadBucket, {
//       events: [s3.EventType.OBJECT_CREATED],
//     })
//   );

//   return uploadedDocumentProcessorLambda;
// }
