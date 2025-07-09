import { BatchUtils } from "@metriport/core/external/aws/batch";
import { getSnowflakeCreds } from "../../external/snowflake/creds";
import { Config } from "../../util/config";

export async function startFhirToCsvBatchJob({ cxId, jobId }: { cxId: string; jobId: string }) {
  const fhirToCsvBatchJobQueueArn = Config.getFhirToCsvBatchJobQueueArn();
  const fhirToCsvBatchJobDefinitionArn = Config.getFhirToCsvBatchJobDefinitionArn();

  if (!fhirToCsvBatchJobQueueArn || !fhirToCsvBatchJobDefinitionArn) {
    throw new Error("Job queue or definition ARN is not set");
  }

  const snowflakeCreds = getSnowflakeCreds();

  const batch = new BatchUtils(Config.getAWSRegion());

  const response = await batch.startJob({
    jobName: `fhir-to-csv-${jobId}`,
    jobQueueArn: fhirToCsvBatchJobQueueArn,
    jobDefinitionArn: fhirToCsvBatchJobDefinitionArn,
    parameters: {
      CX_ID: cxId,
      JOB_ID: jobId,
      SNOWFLAKE_ACCOUNT: snowflakeCreds.account,
      SNOWFLAKE_USER: snowflakeCreds.user,
      SNOWFLAKE_PASSWORD: snowflakeCreds.password,
    },
  });

  console.log(response);
}
