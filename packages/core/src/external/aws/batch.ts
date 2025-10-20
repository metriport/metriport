import { errorToString } from "@metriport/shared";
import * as AWS from "aws-sdk";
import { capture, out } from "../../util";
import { Config } from "../../util/config";

export function makeBatchClient(region: string): AWS.Batch {
  if (!region) throw new Error("No region set");
  return new AWS.Batch({ region });
}

export class BatchUtils {
  public readonly _batch: AWS.Batch;

  constructor(readonly region: string = Config.getAWSRegion()) {
    this._batch = makeBatchClient(region);
  }

  get batch(): AWS.Batch {
    return this._batch;
  }

  async startJob({
    jobName,
    jobQueueArn,
    jobDefinitionArn,
    parameters,
  }: {
    jobName: string;
    jobQueueArn: string;
    jobDefinitionArn: string;
    parameters: AWS.Batch.ParametersMap;
  }): Promise<
    | {
        /** The Amazon Resource Name (ARN) for the job. */
        jobArn?: string;
        /** The name of the job. */
        jobName: string;
        /** The unique identifier for the job. */
        jobId: string;
      }
    | undefined
  > {
    const { log } = out(`startJob`);
    const input: AWS.Batch.SubmitJobRequest = {
      jobName,
      jobQueue: jobQueueArn,
      jobDefinition: jobDefinitionArn,
      parameters,
    };

    try {
      const response = await this.batch.submitJob(input).promise();
      return response;
    } catch (error) {
      const msg = `Error getting response from Batch`;
      log(`${msg} - error: ${errorToString(error)}`);
      capture.message(msg, {
        extra: {
          error: errorToString(error),
          context: "startJob",
          level: "warning",
        },
      });

      return undefined;
    }
  }

  async getJobDetails(jobId: string): Promise<AWS.Batch.JobDetail | undefined> {
    const { log } = out(`getJobStatus`);
    const input: AWS.Batch.DescribeJobsRequest = {
      jobs: [jobId],
    };

    try {
      const response = await this.batch.describeJobs(input).promise();
      return response.jobs?.[0];
    } catch (error) {
      const msg = `Error getting job details from Batch`;
      log(`${msg} - error: ${errorToString(error)}`);
      capture.message(msg, {
        extra: {
          error: errorToString(error),
          context: "getJobDetails",
          level: "warning",
        },
      });

      return undefined;
    }
  }
}
