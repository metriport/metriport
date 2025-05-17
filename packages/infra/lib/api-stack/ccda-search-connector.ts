import { Duration } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { IDomain } from "aws-cdk-lib/aws-opensearchservice";
import * as s3 from "aws-cdk-lib/aws-s3";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { IQueue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { OpenSearchConnectorConfig } from "../../config/open-search-config";
import { EnvType } from "../env-type";
import { getConfig } from "../shared/config";
import { createLambda as defaultCreateLambda } from "../shared/lambda";
import { LambdaLayers } from "../shared/lambda-layers";
import OpenSearchConstruct from "../shared/open-search-construct";
import { createQueue as defaultCreateQueue, provideAccessToQueue } from "../shared/sqs";

export function settings(): OpenSearchConnectorConfig & {
  connectorName: string;
  sqs: {
    maxReceiveCount: number;
    retryAttempts: number;
    visibilityTimeout: Duration;
  };
} {
  const config = getConfig();
  return {
    ...config.openSearch,
    connectorName: "CCDAOpenSearch",
    sqs: {
      // Number of times we want to retry a message, this includes throttles!
      maxReceiveCount: 4,
      // The maximum number of times to retry when the function returns an error.
      retryAttempts: 2,
      // How long messages should be invisible for other consumers, based on the lambda timeout
      // We don't care if the message gets reprocessed, so no need to have a huge visibility timeout that makes it harder to move messages to the DLQ
      visibilityTimeout: Duration.seconds(config.openSearch.lambda.timeout.toSeconds() * 2 + 1),
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
    sqs: { maxReceiveCount, visibilityTimeout, retryAttempts },
  } = settings();

  const openSearch = new OpenSearchConstruct(stack, connectorName, {
    awsAccount,
    region: config.region,
    vpc,
    ...openSearchConfig,
    alarmAction: alarmSnsAction,
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
    alarmMaxAgeOfOldestMessage: Duration.minutes(2),
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
      ...(config.lambdasSentryDSN ? { SENTRY_DSN: config.lambdasSentryDSN } : {}),
      SEARCH_HOST: "https://" + openSearch.domain.domainEndpoint,
      SEARCH_USER: openSearch.creds.username,
      SEARCH_SECRET_NAME: openSearch.creds.secret.secretName,
      SEARCH_INDEX_NAME: openSearchConfig.indexName,
    },
    retryAttempts,
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
