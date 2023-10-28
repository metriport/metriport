import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { CodeChallengeFromSecretManager } from "@metriport/core/domain/auth/code-challenge/code-challenge-on-secrets";
import { CookieManagerOnSecrets } from "@metriport/core/domain/auth/cookie-management/cookie-manager-on-secrets";
import { CommonWellManagementAPI } from "@metriport/core/external/commonwell/management/api";
import {
  SessionManagement,
  SessionManagementConfig,
} from "@metriport/core/external/commonwell/management/session";
import * as Sentry from "@sentry/serverless";
import { capture } from "./shared/capture";
import { getEnv, getEnvOrFail } from "./shared/env";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnv("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvOrFail("AWS_REGION");
// Set by us
const cookieSecretArn = getEnvOrFail("COOKIE_SECRET_ARN");
const codeChallengeSecretArn = getEnvOrFail("CODE_CHALLENGE_SECRET_ARN");
const codeChallengeNotificationUrl = getEnvOrFail("CODE_CHALLENGE_NOTIF_URL");
const cwCredsSecretName = getEnvOrFail("CW_MGMT_CREDS_SECRET_NAME");
const baseUrl = getEnvOrFail("CW_MGMT_URL");

const cookieManager = new CookieManagerOnSecrets(cookieSecretArn, region);
const cwManagementApi = new CommonWellManagementAPI({ cookieManager, baseUrl });
// TODO 1195 move this to an email based code challenge, so it can be fully automated.
// Could use AWS SES for that, it can send the email to a SNS topic, which could trigger
// a lambda and update the secret: https://docs.aws.amazon.com/ses/latest/dg/receiving-email-concepts.html
const codeChallenge = new CodeChallengeFromSecretManager(
  codeChallengeSecretArn,
  region,
  codeChallengeNotificationUrl
);

/**
 * Lambda that executes the logic to keep the session w/ CW active.
 */
export const handler = Sentry.AWSLambda.wrapHandler(async () => {
  console.log(
    `Running with cookieSecretArn: ${cookieSecretArn}, ` +
      `codeChallengeSecretArn: ${codeChallengeSecretArn}, ` +
      `baseUrl: ${baseUrl}`
  );
  try {
    const { username, password } = await getCreds();
    console.log(`...username ${username}, password 🤫`);

    const props: SessionManagementConfig = {
      username,
      password,
      cookieManager,
      cwManagementApi,
      codeChallenge,
    };
    const cwSession = new SessionManagement(props);

    await cwSession.keepSessionActive();

    console.log(`Done.`);
  } catch (error) {
    const additional = {
      cookieSecretArn,
      codeChallengeSecretArn,
      baseUrl,
    };
    console.log(`Error`, error);
    capture.error(error, { extra: { ...additional, lambdaName, error } });
  }
});

async function getCreds(): Promise<{ username: string; password: string }> {
  const credsAsString = (await getSecret(cwCredsSecretName, {
    // https://docs.powertools.aws.dev/lambda/typescript/latest/utilities/parameters/#always-fetching-the-latest
    forceFetch: true, // disables caching
  })) as string;
  if (!credsAsString) throw new Error(`Couldn't retrieve secret ${cwCredsSecretName}`);
  const creds = JSON.parse(credsAsString);
  if (!creds.username) throw new Error(`Missing username property on creds`);
  if (!creds.password) throw new Error(`Missing password property on creds`);
  return { username: creds.username, password: creds.password };
}
