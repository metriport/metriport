import { errorToString } from "@metriport/shared";
import * as AWS from "aws-sdk";
import { capture, out } from "../../util";
import { Config } from "../../util/config";

const region = Config.getAWSRegion();

export function makeBatchClient(): AWS.Batch {
  if (!region) throw new Error("No region set");
  return new AWS.Batch({ region });
}

export class BatchUtils {
  public readonly _batch: AWS.Batch;

  constructor(readonly region: string) {
    this._batch = makeBatchClient();
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
    parameters: Record<string, string>;
  }) {
    const { log } = out(`startJob`);
    const input = {
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
          error,
          context: "startJob",
          level: "warning",
        },
      });

      return undefined;
    }
  }
}
