import { Duration } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { EbsDeviceVolumeType, IVpc } from "aws-cdk-lib/aws-ec2";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { IDomain } from "aws-cdk-lib/aws-opensearchservice";
import * as s3 from "aws-cdk-lib/aws-s3";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { IQueue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { EnvType } from "../env-type";
import { METRICS_NAMESPACE, getConfig } from "../shared/config";
import { createLambda as defaultCreateLambda } from "../shared/lambda";
import { LambdaLayers } from "../shared/lambda-layers";
import OpenSearchConstruct, { OpenSearchConstructProps } from "../shared/open-search-construct";
import { createQueue as defaultCreateQueue, provideAccessToQueue } from "../shared/sqs";
import { isProd, isSandbox } from "../shared/util";

export function settings(): {
  openSearch: Omit<OpenSearchConstructProps, "region" | "vpc" | "awsAccount"> & {
    indexName: string;
  };
  connectorName: string;
  lambda: {
    memory: number;
    batchSize: number;
    maxConcurrency: number;
    timeout: Duration;
  };
  sqs: {
    maxReceiveCount: number;
    visibilityTimeout: Duration;
    delayWhenRetrying: Duration;
  };
} {
  // TODO 1050 once this works well in staging, we can attempt a smaller/cheaper setup for it, but first validate
  // the prod one, so we don't test prod only when releasing there.
  const config = getConfig();
  const isLarge = isProd(config) || isSandbox(config);
  // How long can the lambda run for, max is 900 seconds (15 minutes)
  const timeout = Duration.minutes(1);
  return {
    // https://docs.aws.amazon.com/opensearch-service/latest/developerguide/supported-instance-types.html
    openSearch: {
      capacity: {
        dataNodes: isLarge ? 2 : 2,
        dataNodeInstanceType: isLarge ? "m6g.large.search" : "t3.medium.search",
        masterNodes: isLarge ? 3 : undefined, // odd number, 3+; when not set this is done by data nodes
        // https://docs.aws.amazon.com/opensearch-service/latest/developerguide/managedomains-dedicatedmasternodes.html#dedicatedmasternodes-instance
        masterNodeInstanceType: isLarge ? "m6g.large.search" : undefined,
        warmNodes: 0,
      },
      ebs: {
        volumeSize: isLarge ? 50 : 10, // in GB, total is times amount of data nodes
        volumeType: EbsDeviceVolumeType.GENERAL_PURPOSE_SSD_GP3,
      },
      encryptionAtRest: true,
      indexName: "ccda-files",
    },
    connectorName: "CCDAOpenSearch",
    lambda: {
      memory: isLarge ? 2048 : 512,
      // Number of messages the lambda pull from SQS at once
      batchSize: 1,
      // Max number of concurrent instances of the lambda that an Amazon SQS event source can invoke [2 - 1000].
      maxConcurrency: isLarge ? 10 : 5,
      // How long can the lambda run for, max is 900 seconds (15 minutes)
      timeout,
    },
    sqs: {
      // Number of times we want to retry a message, this includes throttles!
      maxReceiveCount: 2,
      // How long messages should be invisible for other consumers, based on the lambda timeout
      // We don't care if the message gets reprocessed, so no need to have a huge visibility timeout that makes it harder to move messages to the DLQ
      visibilityTimeout: Duration.seconds(timeout.toSeconds() * 2 + 1),
      delayWhenRetrying: Duration.seconds(10),
    },
  };
}

export function setup({
  stack,
  awsAccount,
  vpc,
  ccdaS3Bucket,
  lambdaLayers,
  envType,
  alarmSnsAction,
}: {
  stack: Construct;
  awsAccount: string;
  vpc: IVpc;
  ccdaS3Bucket: s3.IBucket;
  lambdaLayers: LambdaLayers;
  envType: EnvType;
  alarmSnsAction?: SnsAction;
}): {
  queue: IQueue;
  lambda: IFunction;
  searchDomain: IDomain;
  searchDomainUserName: string;
  searchDomainSecret: ISecret;
  indexName: string;
} {
  const config = getConfig();
  const {
    connectorName,
    openSearch: openSearchConfig,
    lambda: { memory, timeout, batchSize, maxConcurrency },
    sqs: { maxReceiveCount, visibilityTimeout, delayWhenRetrying },
  } = settings();

  const openSearch = new OpenSearchConstruct(stack, connectorName, {
    awsAccount,
    region: config.region,
    vpc,
    ...openSearchConfig,
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
    lambdaLayers: [lambdaLayers.shared],
    envType,
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
    layers: [lambdaLayers.shared],
    memory,
    envType: config.environmentType,
    envVars: {
      METRICS_NAMESPACE,
      DELAY_WHEN_RETRY_SECONDS: delayWhenRetrying.toSeconds().toString(),
      ...(config.lambdasSentryDSN ? { SENTRY_DSN: config.lambdasSentryDSN } : {}),
      QUEUE_URL: queue.queueUrl,
      DLQ_URL: dlq.queue.queueUrl,
      SEARCH_HOST: openSearch.domain.domainEndpoint,
      SEARCH_USER: openSearch.creds.username,
      SEARCH_SECRET_NAME: openSearch.creds.secret.secretName,
      SEARCH_INDEX_NAME: openSearchConfig.indexName,
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
  openSearch.creds.secret.grantRead(lambda);

  return {
    queue,
    lambda,
    searchDomain: openSearch.domain,
    searchDomainUserName: openSearch.creds.username,
    searchDomainSecret: openSearch.creds.secret,
    indexName: openSearchConfig.indexName,
  };
}
