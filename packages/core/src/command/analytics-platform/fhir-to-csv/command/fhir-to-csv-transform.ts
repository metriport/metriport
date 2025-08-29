import { executeWithNetworkRetries } from "@metriport/shared";
import { getLambdaResultPayload, makeLambdaClient } from "../../../../external/aws/lambda";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";

export type StartFhirToCsvTransformParams = {
  cxId: string;
  jobId: string;
  patientId: string;
  outputPrefix: string;
  timeoutInMillis?: number | undefined;
};

export async function startFhirToCsvTransform({
  cxId,
  jobId,
  patientId,
  outputPrefix,
  timeoutInMillis,
}: StartFhirToCsvTransformParams): Promise<void> {
  const { log } = out(`FhirToCsvTransform - cx ${cxId} pt ${patientId} job ${jobId}`);
  const lambdaName = Config.getFhirToCsvTransformLambdaName();
  log(`Invoking lambda ${lambdaName}`);
  const payload = JSON.stringify({
    JOB_ID: jobId,
    CX_ID: cxId,
    PATIENT_ID: patientId,
    OUTPUT_PREFIX: outputPrefix,
    API_URL: `http://${Config.getApiUrl()}`,
  });
  await executeWithNetworkRetries(async () => {
    const result = await makeLambdaClient(Config.getAWSRegion(), timeoutInMillis)
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
