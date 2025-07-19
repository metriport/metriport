import { BadRequestError } from "@metriport/shared";
import { BatchUtils } from "../../../../external/aws/batch";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { getSnowflakeCreds } from "../../config";

export async function startFhirToCsvBatchJob({
  cxId,
  jobId,
  patientId,
  inputBundle,
}: {
  cxId: string;
  jobId: string;
  patientId?: string;
  inputBundle?: string;
}) {
  const { log } = out(`startFhirToCsvBatchJob - cx ${cxId}, pt ${patientId}, job ${jobId}`);

  const fhirToCsvBatchJobQueueArn = Config.getFhirToCsvBatchJobQueueArn();
  const fhirToCsvBatchJobDefinitionArn = Config.getFhirToCsvBatchJobDefinitionArn();

  if (!fhirToCsvBatchJobQueueArn || !fhirToCsvBatchJobDefinitionArn) {
    throw new BadRequestError("Job queue or definition ARN is not set");
  }

  if (inputBundle && !patientId) {
    throw new BadRequestError("Patient ID is required when inputBundle is provided");
  }

  const snowflakeCreds = getSnowflakeCreds();

  const batch = new BatchUtils(Config.getAWSRegion());

  const response = await batch.startJob({
    jobName: `fhir-to-csv-${jobId}`,
    jobQueueArn: fhirToCsvBatchJobQueueArn,
    jobDefinitionArn: fhirToCsvBatchJobDefinitionArn,
    parameters: {
      jobId: jobId,
      cxId: cxId,
      patientId: patientId ?? "",
      inputBundle: inputBundle ?? "",
      apiUrl: `http://${Config.getApiUrl()}`,
      snowflakeAccount: snowflakeCreds.account,
      snowflakeUser: snowflakeCreds.user,
      snowflakePassword: snowflakeCreds.password,
    },
  });

  log(`>>> Job started: ${JSON.stringify(response)}`);
}
