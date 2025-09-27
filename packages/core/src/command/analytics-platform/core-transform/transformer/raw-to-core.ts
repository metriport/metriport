import { InvokeCommand } from "@aws-sdk/client-lambda";
import { DbCreds, executeWithNetworkRetries } from "@metriport/shared";
import { getLambdaResultPayloadV3, makeLambdaClientV3 } from "../../../../external/aws/lambda";
import { out } from "../../../../util/log";

export type RawToCoreLambdaRequest = {
  DATABASE: string;
  USER: string;
  PASSWORD: string;
};

/**
 * Calls the service that transforms the raw data into the core data.
 */
export async function transformRawToCore({
  cxId,
  dbCreds,
  region,
  lambdaName,
}: {
  cxId: string;
  dbCreds: DbCreds;
  region: string;
  lambdaName: string;
}): Promise<void> {
  const { log } = out(`transformRawToCore - cx ${cxId}`);

  const lambdaClient = makeLambdaClientV3(region);

  const payload: RawToCoreLambdaRequest = {
    DATABASE: dbCreds.dbname,
    USER: dbCreds.username,
    PASSWORD: dbCreds.password,
  };
  const payloadAsString = JSON.stringify(payload);

  log(`Invoking lambda ${lambdaName}...`);
  const command = new InvokeCommand({
    FunctionName: lambdaName,
    InvocationType: "RequestResponse",
    Payload: payloadAsString,
  });
  await executeWithNetworkRetries(async () => {
    const result = await lambdaClient.send(command);
    const resultPayload = getLambdaResultPayloadV3({
      result,
      lambdaName: lambdaName,
    });
    return JSON.parse(resultPayload);
  });
}
