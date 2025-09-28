import { BadRequestError, MetriportError } from "@metriport/shared";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { BatchUtils } from "../../../../external/aws/batch";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { executeWithNetworkRetries } from "@metriport/shared";

// TODO move this to core-transfor-cloud.ts
export async function startCoreTransform({
  cxId,
  jobId = uuidv7(),
  database,
  schema,
}: {
  cxId: string;
  jobId?: string;
  database: string;
  schema: string;
}): Promise<string> {
  const { log } = out(`startCoreTransform - cx ${cxId}, job ${jobId}`);

  const coreTransformBatchJobQueueArn = Config.getCoreTransformBatchJobQueueArn();
  const coreTransformBatchJobDefinitionArn = Config.getCoreTransformBatchJobDefinitionArn();

  if (!coreTransformBatchJobQueueArn || !coreTransformBatchJobDefinitionArn) {
    throw new BadRequestError("Job queue or definition ARN is not set", undefined, {
      cxId,
      jobId,
      database,
      schema,
    });
  }

  const batch = new BatchUtils(Config.getAWSRegion());

  const response = await executeWithNetworkRetries(async () => {
    return await batch.startJob({
      jobName: `core-transform-${jobId}`,
      jobQueueArn: coreTransformBatchJobQueueArn,
      jobDefinitionArn: coreTransformBatchJobDefinitionArn,
      parameters: {
        database,
        schema,
      },
    });
  });
  if (!response?.jobId) {
    throw new MetriportError("Failed to start job", undefined, {
      cxId,
      jobId,
      database,
      schema,
      response: JSON.stringify(response),
    });
  }

  log(`>>> Job started: ${JSON.stringify(response)}`);
  return response.jobId;
}
