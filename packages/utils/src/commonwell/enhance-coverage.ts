import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { cookieFromString, CookieManager } from "@metriport/core/domain/cookie-manager";
import { CommonWellManagementAPI } from "@metriport/core/external/commonwell/management/api";
import {
  SessionManagement,
  SessionManagementConfig,
} from "@metriport/core/external/commonwell/management/session";
import { getEnvVar, getEnvVarOrFail } from "@metriport/core/util/env-var";
import { CodeChallengeFromTerminal } from "./code-challenge-terminal";

/**
 * Script to run on local environment the code that enhances coverage @ CommonWell.
 *
 * To test it with an active session, set the cookies on an env var or .env file (see instructions
 * on how to obtain it below).
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

const cookieManager = new CookieManager();
const props: SessionManagementConfig = {
  username: cwUsername,
  password: cwPassword,
  cookieManager,
  cwManagementApi: new CommonWellManagementAPI({ cookieManager, baseUrl: cwBaseUrl }),
  codeChallenge: new CodeChallengeFromTerminal(),
  headless: false,
};

export async function main() {
  console.log(`Testing SessionManagement.keepSessionActive()...`);

  const actualCookies = cookies
    .split(";")
    .map(i => i.trim())
    .flatMap(c => cookieFromString(c) ?? []);
  cookieManager.updateCookies(actualCookies);

  const cwSession = new SessionManagement(props);
  await cwSession.keepSessionActive();
}

main();
