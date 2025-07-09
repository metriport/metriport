import { BatchUtils } from "@metriport/core/external/aws/batch";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { getSnowflakeCreds } from "../../external/snowflake/creds";
import { Config } from "../../util/config";

// TODO Get snowflake credentials from secrets manager

export async function startFhirToCsvBatchJob({
  cxId,
  requestId: requestIdParams,
}: {
  cxId: string;
  requestId?: string;
}) {
  const fhirToCsvBatchJobQueueArn = Config.getFhirToCsvBatchJobQueueArn();
  const fhirToCsvBatchJobDefinitionArn = Config.getFhirToCsvBatchJobDefinitionArn();

  if (!fhirToCsvBatchJobQueueArn || !fhirToCsvBatchJobDefinitionArn) {
    throw new Error("Job queue or definition ARN is not set");
  }

  const requestId = requestIdParams || uuidv7();
  const snowflakeCreds = getSnowflakeCreds();

  const batch = new BatchUtils(Config.getAWSRegion());

  const response = await batch.startJob({
    jobName: `fhir-to-csv-${requestId}`,
    jobQueueArn: fhirToCsvBatchJobQueueArn,
    jobDefinitionArn: fhirToCsvBatchJobDefinitionArn,
    parameters: {
      CX_ID: cxId,
      REQUEST_ID: requestId,
      SNOWFLAKE_ACCOUNT: snowflakeCreds.account,
      SNOWFLAKE_USER: snowflakeCreds.user,
      SNOWFLAKE_PASSWORD: snowflakeCreds.password,
    },
  });

  console.log(response);
}
