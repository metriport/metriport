import { executeWithNetworkRetries } from "@metriport/shared";
import { getLambdaResultPayload, makeLambdaClient } from "../../../../external/aws/lambda";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { getSnowflakeCreds } from "../../config";

export type StartFhirToCsvTransformParams = {
  cxId: string;
  jobId: string;
  patientId: string;
  inputBundle?: string;
};

export async function startFhirToCsvTransform({
  cxId,
  jobId,
  patientId,
  inputBundle,
}: StartFhirToCsvTransformParams): Promise<void> {
  const { log } = out(`FhirToCsvTransform - cx ${cxId} pt ${patientId} job ${jobId}`);
  const lambdaName = Config.getFhirToCsvTransformLambdaName();
  const snowflakeCreds = getSnowflakeCreds();
  log(`Invoking lambda ${lambdaName}`);
  const payload = JSON.stringify({
    JOB_ID: jobId,
    CX_ID: cxId,
    PATIENT_ID: patientId,
    ...(inputBundle ? { INPUT_BUNDLE: inputBundle } : {}),
    API_URL: `http://${Config.getApiUrl()}`,
    SNOWFLAKE_CREDS: snowflakeCreds,
  });
  await executeWithNetworkRetries(async () => {
    const result = await makeLambdaClient(Config.getAWSRegion())
      .invoke({
        FunctionName: lambdaName,
        InvocationType: "RequestResponse",
        Payload: payload,
      })
      .promise();
    const resultPayload = getLambdaResultPayload({
      result,
      lambdaName,
    });
    return JSON.parse(resultPayload);
  });
}
