import { Duration } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { EbsDeviceVolumeType, IVpc } from "aws-cdk-lib/aws-ec2";
import { IFunction, ILayerVersion } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { IDomain } from "aws-cdk-lib/aws-opensearchservice";
import * as s3 from "aws-cdk-lib/aws-s3";
import { IQueue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { getConfig, METRICS_NAMESPACE } from "../shared/config";
import { createLambda as defaultCreateLambda } from "../shared/lambda";
import OpenSearchConstruct from "../shared/open-search-construct";
import { createQueue as defaultCreateQueue, provideAccessToQueue } from "../shared/sqs";
import { isProd, isSandbox } from "../shared/util";

export function settings() {
  const config = getConfig();
  const isLarge = isProd(config) || isSandbox(config);
  // How long can the lambda run for, max is 900 seconds (15 minutes)
  const timeout = Duration.minutes(5);
  return {
    // https://docs.aws.amazon.com/opensearch-service/latest/developerguide/supported-instance-types.html
    openSearch: {
      capacity: {
        dataNodes: isLarge ? 2 : 1,
        dataNodeInstanceType: isLarge ? "t3.small.search" : "t3.small.search",
        masterNodes: isLarge ? 3 : undefined, // when not large this is done by data nodes
        masterNodeInstanceType: isLarge ? "t3.small.search" : undefined,
      },
      ebs: {
        volumeSize: 10,
        volumeType: EbsDeviceVolumeType.GENERAL_PURPOSE_SSD_GP3,
      },
    },
    connectorName: "CCDAOpenSearch",
    lambda: {
      memory: 512,
      // Number of messages the lambda pull from SQS at once
      batchSize: 1,
      // Max number of concurrent instances of the lambda that an Amazon SQS event source can invoke [2 - 1000].
      maxConcurrency: isLarge ? 4 : 2,
      // How long can the lambda run for, max is 900 seconds (15 minutes)
      timeout,
    },
    sqs: {
      // Number of times we want to retry a message, this includes throttles!
      maxReceiveCount: 5,
      // How long messages should be invisible for other consumers, based on the lambda timeout
      // We don't care if the message gets reprocessed, so no need to have a huge visibility timeout that makes it harder to move messages to the DLQ
      visibilityTimeout: Duration.seconds(timeout.toSeconds() * 2 + 1),
      delayWhenRetrying: Duration.seconds(10),
    },
  };
}

export function setup({
  stack,
  vpc,
  ccdaS3Bucket,
  lambdaLayers,
  alarmSnsAction,
}: {
  stack: Construct;
  vpc: IVpc;
  ccdaS3Bucket: s3.IBucket;
  lambdaLayers: ILayerVersion[];
  alarmSnsAction?: SnsAction;
}): { queue: IQueue; lambda: IFunction; searchDomain: IDomain } {
  const config = getConfig();
  const {
    connectorName,
    openSearch: { capacity, ebs },
    lambda: { memory, timeout, batchSize, maxConcurrency },
    sqs: { maxReceiveCount, visibilityTimeout, delayWhenRetrying },
  } = settings();

  const openSearch = new OpenSearchConstruct(stack, connectorName, {
    region: config.region,
    vpc,
    capacity,
    ebs,
  });

  // setup queue and lambda to process the ccda files
  const queue = defaultCreateQueue({
    stack,
    name: connectorName,
    // To use FIFO we'd need to change the lambda code to set visibilityTimeout=0 on messages to be
    // reprocessed, instead of re-enqueueing them (bc of messageDeduplicationId visibility of 5min)
    fifo: false,
    visibilityTimeout,
    maxReceiveCount,
    lambdaLayers,
    alarmSnsAction,
  });

  const dlq = queue.deadLetterQueue;
  if (!dlq) throw Error(`Missing DLQ of Queue ${queue.queueName}`);

  const lambda = defaultCreateLambda({
    stack,
    name: connectorName,
    vpc,
    subnets: vpc.privateSubnets,
    entry: "sqs-to-opensearch-xml",
    layers: lambdaLayers,
    memory,
    envVars: {
      METRICS_NAMESPACE,
      ENV_TYPE: config.environmentType,
      DELAY_WHEN_RETRY_SECONDS: delayWhenRetrying.toSeconds().toString(),
      ...(config.lambdasSentryDSN ? { SENTRY_DSN: config.lambdasSentryDSN } : {}),
      QUEUE_URL: queue.queueUrl,
      DLQ_URL: dlq.queue.queueUrl,
      SEARCH_HOST: openSearch.domain.domainEndpoint,
      SEARCH_USER: openSearch.creds.user,
      SEARCH_SECRET_NAME: openSearch.creds.secretName,
      SEARCH_INDEX_NAME: "ccda-files",
    },
    timeout,
    alarmSnsAction,
  });

  ccdaS3Bucket.grantRead(lambda);
  lambda.addEventSource(
    new SqsEventSource(queue, {
      batchSize: batchSize,
      // Partial batch response: https://docs.aws.amazon.com/prescriptive-guidance/latest/lambda-event-filtering-partial-batch-responses-for-sqs/welcome.html
      reportBatchItemFailures: true,
      maxConcurrency,
    })
  );
  provideAccessToQueue({ accessType: "both", queue, resource: lambda });
  provideAccessToQueue({ accessType: "send", queue: dlq.queue, resource: lambda });

  return { queue, lambda, searchDomain: openSearch.domain };
}
