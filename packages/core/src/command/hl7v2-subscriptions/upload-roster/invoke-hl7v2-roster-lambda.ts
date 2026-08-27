import { getEnvVarOrFail } from "@metriport/shared";
import { getLambdaResultPayload, makeLambdaClient } from "../../../external/aws/lambda";
import { HieConfig, VpnlessHieConfig } from "../types";
import { Hl7v2RosterGenerator } from "../hl7v2-roster-generator";

/**
 * Invokes the HL7v2 roster lambda.
 * @param config The HieConfig or VpnlessHieConfig to upload the roster for.
 */
export async function invokeHl7v2RosterLambda(config: HieConfig | VpnlessHieConfig): Promise<void> {
  const region = getEnvVarOrFail("AWS_REGION");
  const lambdaName = `Hl7v2RosterUpload-${config.name}Lambda`;
  const lambdaClient = makeLambdaClient(region);

  const result = await lambdaClient
    .invoke({
      FunctionName: lambdaName,
      InvocationType: "RequestResponse",
      Payload: JSON.stringify(config),
    })
    .promise();

  getLambdaResultPayload({ result, lambdaName });
}

/**
 * Invokes the HL7v2 roster lambda code directly.
 * Should only be used for local development.
 * @param config The HieConfig or VpnlessHieConfig to upload the roster for.
 */
export async function invokeHl7v2RosterLambdaDirect(
  config: HieConfig | VpnlessHieConfig
): Promise<void> {
  const apiUrl = getEnvVarOrFail("API_URL");
  const bucketName = getEnvVarOrFail("HL7V2_ROSTER_BUCKET_NAME");

  await new Hl7v2RosterGenerator(apiUrl, bucketName).execute(config);
}
