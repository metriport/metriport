import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { CodeChallengeFromSecretManager } from "@metriport/core/domain/auth/code-challenge/code-challenge-on-secrets";
import { CookieManagerOnSecrets } from "@metriport/core/domain/auth/cookie-management/cookie-manager-on-secrets";
import { makeS3Client } from "@metriport/core/external/aws/s3";
import { CommonWellManagementAPI } from "@metriport/core/external/commonwell/management/api";
import {
  SessionManagement,
  SessionManagementConfig,
} from "@metriport/core/external/commonwell/management/session";
import { base64ToBuffer } from "@metriport/core/util/base64";
import { AdditionalInfo } from "@metriport/core/util/capture";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import * as Sentry from "@sentry/serverless";

import * as playwright from "playwright-aws-lambda";
// import playwright from 'playwright-aws-lambda';
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
const errorBucketName = getEnvOrFail("ERROR_BUCKET_NAME");

const s3Client = makeS3Client(region);
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
  let screenshotIdx = 0;
  const screenshot = async (screenshotAsB64: string, title: string) => {
    console.log(`Screenshot!`);
    await s3Client
      .putObject({
        Bucket: errorBucketName,
        Key: `lambdas/${lambdaName}/run_${new Date().toISOString()}/screenshot${++screenshotIdx}_${title}.jpg`,
        Body: base64ToBuffer(screenshotAsB64),
      })
      .promise();
  };

  try {
    const { username, password } = await getCreds();
    console.log(`...username ${username}, password 🤫`);

    const browser = await playwright.launchChromium({
      headless: true,
    });

    const props: SessionManagementConfig = {
      username,
      password,
      cookieManager,
      cwManagementApi,
      codeChallenge,
      browser,
      debug: console.log,
      screenshot,
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

    if (error instanceof MetriportError) reportErrorToS3(error, additional);

    throw error;
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

async function reportErrorToS3(error: MetriportError, additional: AdditionalInfo) {
  try {
    const contents = error.additionalInfo?.[SessionManagement.exceptionScreenshotKey] as
      | string
      | undefined;
    if (contents) {
      await s3Client
        .putObject({
          Bucket: errorBucketName,
          Key: `lambdas/${lambdaName}/error_${new Date().toISOString()}.jpg`,
          Body: base64ToBuffer(contents),
        })
        .promise();
    } else {
      console.log(`MetriportError but no b64 screenshot`);
    }
  } catch (error) {
    console.log(`Error on reportErrorToS3`, error);
    capture.error(error, {
      extra: {
        ...additional,
        lambdaName,
        error,
        context: "reportErrorToS3",
      },
    });
    // intentionally not throwing here
  }
}
