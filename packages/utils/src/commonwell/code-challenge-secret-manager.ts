import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { CodeChallengeFromSecretManager } from "@metriport/core/domain/auth/code-challenge/code-challenge-on-secrets";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";

/**
 * Script to test the CodeChallengeFromSecretManager class.
 */

const region = getEnvVarOrFail("AWS_REGION");
const secretArn = getEnvVarOrFail("CW_CODE_CHALLENGE_SECRET_ARN");
const notificationUrl = getEnvVarOrFail("SLACK_NOTIFICATION_URL");

const codeChallenge = new CodeChallengeFromSecretManager(secretArn, region, notificationUrl);

export async function main() {
  console.log(`Testing CodeChallengeFromSecretManager...`);

  const code = await codeChallenge.getCode();
  console.log(`Got this code: ${code}`);
}

main();
