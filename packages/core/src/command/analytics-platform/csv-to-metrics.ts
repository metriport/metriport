import { BatchUtils } from "../../external/aws/batch";
import { Config } from "../../util/config";

export async function startCsvToMetricsBatchJob({ cxId, jobId }: { cxId: string; jobId: string }) {
  const csvToMetricsBatchJobQueueArn = Config.getCsvToMetricsBatchJobQueueArn();
  const csvToMetricsBatchJobDefinitionArn = Config.getCsvToMetricsBatchJobDefinitionArn();

  if (!csvToMetricsBatchJobQueueArn || !csvToMetricsBatchJobDefinitionArn) {
    throw new Error("Job queue or definition ARN is not set");
  }

  const snowflakeCreds = Config.getSnowflakeCreds();

  const batch = new BatchUtils(Config.getAWSRegion());

  const response = await batch.startJob({
    jobName: `csv-to-metrics-${jobId}`,
    jobQueueArn: csvToMetricsBatchJobQueueArn,
    jobDefinitionArn: csvToMetricsBatchJobDefinitionArn,
    parameters: {
      CX_ID: cxId,
      JOB_ID: jobId,
      DBT_SNOWFLAKE_CI_ACCOUNT: snowflakeCreds.account,
      DBT_SNOWFLAKE_CI_USER: snowflakeCreds.user,
      DBT_SNOWFLAKE_CI_PASSWORD: snowflakeCreds.password,
    },
  });

  console.log(response);
}
