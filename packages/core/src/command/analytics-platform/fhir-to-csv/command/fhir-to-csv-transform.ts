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
  const { log } = out(`FhirToCsvTransform - cx ${cxId}`);
  const lambdaName = Config.getFhirToCsvTransformLambdaName();
  const snowflakeCreds = getSnowflakeCreds();
  log(`Invoking lambda ${lambdaName}`);
  const payload = JSON.stringify({
    cxId,
    jobId,
    patientId,
    ...(inputBundle ? { inputBundle } : {}),
    apiUrl: `http://${Config.getApiUrl()}`,
    snowflakeCreds,
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
