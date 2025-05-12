import { Duration } from "aws-cdk-lib";
import { OpenSearchConstructProps } from "../lib/shared/open-search-construct";

export type LambdaConfig = {
  memory: number;
  /** Number of messages the lambda pull from SQS at once */
  batchSize: number;
  /** Max number of concurrent instances of the lambda that an Amazon SQS event source can invoke [2 - 1000]. */
  maxConcurrency: number;
  /** How long can the lambda run for, max is 900 seconds (15 minutes) */
  timeout: Duration;
};

export type OpenSearchConnectorConfig = {
  openSearch: Omit<OpenSearchConstructProps, "region" | "vpc" | "awsAccount"> & {
    indexName: string;
  };
  lambda: LambdaConfig;
};

export type SemanticOpenSearchConfig = {
  modelId: string;
  endpoint: string;
  indexName: string;
  userName: string;
  // TODO eng-41 Remove this and move it to an actual Secret before going to prod
  password: string;
};
