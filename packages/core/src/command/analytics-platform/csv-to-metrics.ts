import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { BatchUtils } from "../../external/aws/batch";
import { Config } from "../../util/config";

// TODO Get snowflake credentials from secrets manager

export async function startCsvToMetricsBatchJob({
  cxId,
  requestId: requestIdParams,
}: {
  cxId: string;
  requestId?: string;
}) {
  const csvToMetricsBatchJobQueueArn = Config.getCsvToMetricsBatchJobQueueArn();
  const csvToMetricsBatchJobDefinitionArn = Config.getCsvToMetricsBatchJobDefinitionArn();

  if (!csvToMetricsBatchJobQueueArn || !csvToMetricsBatchJobDefinitionArn) {
    throw new Error("Job queue or definition ARN is not set");
  }

  const requestId = requestIdParams || uuidv7();

  const batch = new BatchUtils(Config.getAWSRegion());

  const response = await batch.startJob({
    jobName: `csv-to-metrics-${requestId}`,
    jobQueueArn: csvToMetricsBatchJobQueueArn,
    jobDefinitionArn: csvToMetricsBatchJobDefinitionArn,
    parameters: {
      CX_ID: cxId,
      REQUEST_ID: requestId,
    },
  });

  console.log(response);
}
