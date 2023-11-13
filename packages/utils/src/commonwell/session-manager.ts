import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { CodeChallenge } from "@metriport/core/domain/auth/code-challenge";
import { CodeChallengeFromSecretManager } from "@metriport/core/domain/auth/code-challenge/code-challenge-on-secrets";
import { cookieFromString } from "@metriport/core/domain/auth/cookie-management/cookie-manager";
import { CookieManagerInMemory } from "@metriport/core/domain/auth/cookie-management/cookie-manager-in-memory";
import { CookieManagerOnSecrets } from "@metriport/core/domain/auth/cookie-management/cookie-manager-on-secrets";
import { CommonWellManagementAPI } from "@metriport/core/external/commonwell/management/api";
import {
  SessionManagement,
  SessionManagementConfig,
} from "@metriport/core/external/commonwell/management/session";
import { getEnvVar, getEnvVarOrFail } from "@metriport/core/util/env-var";
import * as readline from "readline-sync";
// disables AWS SDK maintainance notif
require("aws-sdk/lib/maintenance_mode_message").suppress = true; // eslint-disable-line @typescript-eslint/no-var-requires

// Leaving this separated from the rest as we might need to switch browsers if it fails to get the cookie
// import { chromium as runtime } from "playwright";
import { firefox as runtime } from "playwright";

/**
 * Script to run on local environment the code that keeps the session w/ CommonWell active.
 * This is mostly to test the auth/cookie management code without running coverage enhancement .
 *
 * To test it with an active/existing session, set the cookies on an env var or .env file (see instructions
 * on how to obtain it below).
 *
 * Otherwise it will try to login using the credentials on the env vars and ask for the code challenge through
 * the terminal if it's needed.
 */

// Indicates whether to use in-memory cookie manager and terminal-based code challenge (local), or using secrets (non-local)
const isLocal = false;

// If it fails to get the cookie, we might need to run this on a "headed" browser = update this to false:
const headless = true;

/**
 * To get the cookies, login to the CW portal and go to this page: (https://portal.commonwellalliance.org/Organization/List).
 * In the dev tools, go to Network > Headers > Cookie. The cookies' value will be a massive string.
 * Copy everything from `MP_RQ_COOKIE=` onwards and paste it below.
 */
const cookies = getEnvVar("CW_COOKIES") ?? "";
const cwBaseUrl = getEnvVarOrFail("CW_URL");
const cwUsername = getEnvVarOrFail("CW_USERNAME");
const cwPassword = getEnvVarOrFail("CW_PASSWORD");

/**
 * Code to run this on local environment.
 */
class CodeChallengeFromTerminal implements CodeChallenge {
  async getCode() {
    return readline.question("What's the access code? ");
  }
}
/**
 * Code to run this on a cloud environment, like EC2.
 */
const region = getEnvVarOrFail("AWS_REGION");
const notificationUrl = getEnvVarOrFail("SLACK_NOTIFICATION_URL");

const buildStores = () => {
  if (isLocal) {
    return {
      codeChallenge: new CodeChallengeFromTerminal(),
      cookieManager: new CookieManagerInMemory(),
    };
  }
  const cookiesSecretArn = getEnvVarOrFail("CW_MANAGEMENT_COOKIE_SECRET_ARN");
  const codeChallengeSecretArn = getEnvVarOrFail("CW_CODE_CHALLENGE_SECRET_ARN");
  return {
    codeChallenge: new CodeChallengeFromSecretManager(
      codeChallengeSecretArn,
      region,
      notificationUrl
    ),
    cookieManager: new CookieManagerOnSecrets(cookiesSecretArn, region),
  };
};
const { codeChallenge, cookieManager } = buildStores();

const cwManagementApi = new CommonWellManagementAPI({ cookieManager, baseUrl: cwBaseUrl });

export async function main() {
  console.log(`Runnning at ${new Date().toISOString()}`);

  if (cookies && cookies.trim().length) {
    console.log(`Overwritting cookies...`);
    await cookieManager.updateCookies(cookies.split(";").flatMap(c => cookieFromString(c) ?? []));
  }

  const props: SessionManagementConfig = {
    username: cwUsername,
    password: cwPassword,
    cookieManager,
    cwManagementApi,
    codeChallenge,
    browser: await runtime.launch({
      headless,
      slowMo: 100,
    }),
    errorScreenshotToFileSystem: true,
    // debug: console.log,
  };
  const cwSession = new SessionManagement(props);
  await cwSession.keepSessionActive();

  console.log(`Done at ${new Date().toISOString()}`);
}

main();
