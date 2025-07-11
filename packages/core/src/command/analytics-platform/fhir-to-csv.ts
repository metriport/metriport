import { BatchUtils } from "@metriport/core/external/aws/batch";
import { Config } from "../../util/config";

export async function startFhirToCsvBatchJob({ cxId, jobId }: { cxId: string; jobId: string }) {
  const fhirToCsvBatchJobQueueArn = Config.getFhirToCsvBatchJobQueueArn();
  const fhirToCsvBatchJobDefinitionArn = Config.getFhirToCsvBatchJobDefinitionArn();

  if (!fhirToCsvBatchJobQueueArn || !fhirToCsvBatchJobDefinitionArn) {
    throw new Error("Job queue or definition ARN is not set");
  }

  const snowflakeCreds = Config.getSnowflakeCreds();

  const batch = new BatchUtils(Config.getAWSRegion());

  const response = await batch.startJob({
    jobName: `fhir-to-csv-${jobId}`,
    jobQueueArn: fhirToCsvBatchJobQueueArn,
    jobDefinitionArn: fhirToCsvBatchJobDefinitionArn,
    parameters: {
      cxId: cxId,
      jobId: jobId,
      snowflakeAccount: snowflakeCreds.account,
      snowflakeUser: snowflakeCreds.user,
      snowflakePassword: snowflakeCreds.password,
    },
  });

  console.log(response);
}
