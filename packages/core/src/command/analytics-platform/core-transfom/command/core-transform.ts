import { BadRequestError } from "@metriport/shared";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { BatchUtils } from "../../../../external/aws/batch";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";

export async function startCoreTransform({
  cxId,
  jobId = uuidv7(),
  host,
  user,
  password,
  database,
  schema,
}: {
  cxId: string;
  jobId?: string;
  host: string;
  user: string;
  password: string;
  database: string;
  schema: string;
}): Promise<string> {
  const { log } = out(`startCoreTransform - cx ${cxId}, job ${jobId}`);

  const coreTransformBatchJobQueueArn = Config.getCoreTransformBatchJobQueueArn();
  const coreTransformBatchJobDefinitionArn = Config.getCoreTransformBatchJobDefinitionArn();

  if (!coreTransformBatchJobQueueArn || !coreTransformBatchJobDefinitionArn) {
    throw new BadRequestError("Job queue or definition ARN is not set");
  }

  const batch = new BatchUtils(Config.getAWSRegion());

  const response = await batch.startJob({
    jobName: `core-transform-${jobId}`,
    jobQueueArn: coreTransformBatchJobQueueArn,
    jobDefinitionArn: coreTransformBatchJobDefinitionArn,
    parameters: {
      host,
      user,
      password,
      database,
      schema,
    },
  });

  log(`>>> Job started: ${JSON.stringify(response)}`);
  return jobId;
}
