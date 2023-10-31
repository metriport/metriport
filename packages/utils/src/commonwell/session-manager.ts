import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { cookieFromString } from "@metriport/core/domain/auth/cookie-management/cookie-manager";
import { CookieManagerOnSecrets } from "@metriport/core/domain/auth/cookie-management/cookie-manager-on-secrets";
import { CommonWellManagementAPI } from "@metriport/core/external/commonwell/management/api";
import {
  SessionManagement,
  SessionManagementConfig,
} from "@metriport/core/external/commonwell/management/session";
import { getEnvVar, getEnvVarOrFail } from "@metriport/core/util/env-var";
import { chromium as runtime } from "playwright";
// import { firefox as runtime } from "playwright";
import { CodeChallengeFromSecretManager } from "@metriport/core/domain/auth/code-challenge/code-challenge-on-secrets";

/**
 * Script to run on local environment the code that keeps the session w/ CommonWell active.
 *
 * To test it with an active/existing session, set the cookies on an env var or .env file (see instructions
 * on how to obtain it below).
 *
 * Otherwise it will try to login using the credentials on the env vars and ask for the code challenge through
 * the terminal if it's needed.
 */

/**
 * To get the cookies, login to the CW portal and go to this page: (https://portal.commonwellalliance.org/Organization/List).
 * In the dev tools, go to Network > Headers > Cookie. The cookies' value will be a massive string.
 * Copy everything from `MP_RQ_COOKIE=` onwards and paste it below.
 */
const cookies = getEnvVar("CW_COOKIES") ?? "";
const cwBaseUrl = getEnvVarOrFail("CW_URL");
const cwUsername = getEnvVarOrFail("CW_USERNAME");
const cwPassword = getEnvVarOrFail("CW_PASSWORD");

const region = getEnvVarOrFail("AWS_REGION");
const notificationUrl = getEnvVarOrFail("SLACK_NOTIFICATION_URL");

const cookiesSecretArn = getEnvVarOrFail("CW_COOKIES_SECRET_ARN");
const cookieManager = new CookieManagerOnSecrets(cookiesSecretArn, region);
// const cookieManager = new CookieManagerInMemory();

const codeChallengeSecretArn = getEnvVarOrFail("CW_CODE_CHALLENGE_SECRET_ARN");
const codeChallenge = new CodeChallengeFromSecretManager(
  codeChallengeSecretArn,
  region,
  notificationUrl
);
// class CodeChallengeFromTerminal implements CodeChallenge {
//   async getCode() {
//     return readline.question("What's the access code? ");
//   }
// }

const cwManagementApi = new CommonWellManagementAPI({ cookieManager, baseUrl: cwBaseUrl });

export async function main() {
  console.log(`Testing SessionManagement.keepSessionActive()...`);

  const actualCookies = cookies
    .split(";")
    .map(i => i.trim())
    .flatMap(c => cookieFromString(c) ?? []);
  cookieManager.updateCookies(actualCookies);

  const props: SessionManagementConfig = {
    username: cwUsername,
    password: cwPassword,
    cookieManager,
    cwManagementApi,
    codeChallenge,
    browser: await runtime.launch({
      headless: false,
      // headless: true,
      slowMo: 100,
    }),
    errorScreenshotToFileSystem: true,
    debug: console.log,
  };
  const cwSession = new SessionManagement(props);
  await cwSession.keepSessionActive();
}

main();
