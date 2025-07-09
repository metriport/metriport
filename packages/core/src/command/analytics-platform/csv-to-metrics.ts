import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { BatchUtils } from "../../external/aws/batch";
import { Config } from "../../util/config";
import { getSnowflakeCreds } from "../../external/snowflake/creds";

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
  const snowflakeCreds = getSnowflakeCreds();

  const batch = new BatchUtils(Config.getAWSRegion());

  const response = await batch.startJob({
    jobName: `csv-to-metrics-${requestId}`,
    jobQueueArn: csvToMetricsBatchJobQueueArn,
    jobDefinitionArn: csvToMetricsBatchJobDefinitionArn,
    parameters: {
      CX_ID: cxId,
      REQUEST_ID: requestId,
      DBT_SNOWFLAKE_CI_ACCOUNT: snowflakeCreds.account,
      DBT_SNOWFLAKE_CI_USER: snowflakeCreds.user,
      DBT_SNOWFLAKE_CI_PASSWORD: snowflakeCreds.password,
    },
  });

  console.log(response);
}
