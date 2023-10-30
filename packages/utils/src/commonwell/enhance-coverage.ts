import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { CodeChallenge } from "@metriport/core/domain/auth/code-challenge";
import { cookieFromString } from "@metriport/core/domain/auth/cookie-management/cookie-manager";
import { CookieManagerInMemory } from "@metriport/core/domain/auth/cookie-management/cookie-manager-in-memory";
import { CommonWellManagementAPI } from "@metriport/core/external/commonwell/management/api";
import { LinkPatients } from "@metriport/core/external/commonwell/management/link-patients";
import {
  SessionManagement,
  SessionManagementConfig,
} from "@metriport/core/external/commonwell/management/session";
import { getEnvVar, getEnvVarOrFail } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import * as fs from "fs";
import { chunk } from "lodash";
import { chromium } from "playwright";
import * as readline from "readline-sync";

/**
 * Script to run on local environment the code that enhances coverage @ CommonWell.
 *
 * This will:
 * - loop through chunks of 50 orgs at a time (from `cq-org-list.json`);
 * - for each chunk:
 *    - update CW's "include list" for the customer (cxId) with the orgs on the chunk;
 *    - update the patients on our API, which triggers an update @ CW and get the patient linked
 *      to those CQ orgs in CW.
 *
 * The reason we do this in chunks is because the CW API has a limit of 50 orgs per request.
 *
 * Try to limit the impact on the infrastructure by providing a list of patient IDs below.
 */

const patientIds: string[] = [];

/**
 * During the execution, if the cookie gets outdated and the script errors, you'll need to set the index below
 * to the last one that was successful.
 */
const downloadProgressIndex = 0;

/**
 * You shouldn't need to, but if you want to use existing cookies login to the CW portal and go to
 * this page: (https://portal.commonwellalliance.org/Organization/List).
 * In the dev tools, go to Network > Headers > Cookie. The cookies' value will be a massive string.
 * Copy everything from `MP_RQ_COOKIE=` onwards and paste it below.
 */
const cookies = getEnvVar("CW_COOKIES") ?? undefined;
const cwBaseUrl = getEnvVarOrFail("CW_URL");
const cwUsername = getEnvVarOrFail("CW_USERNAME");
const cwPassword = getEnvVarOrFail("CW_PASSWORD");

const metriportApiBaseUrl = getEnvVarOrFail("API_URL");
const cxId = getEnvVarOrFail("CX_ID");
const cxOrgOID = getEnvVarOrFail("ORG_OID");

const cqOrgsList = fs.readFileSync(`${__dirname}/cq-org-list.json`, "utf8");
const CQ_ORG_CHUNK_SIZE = 50;

class CodeChallengeFromTerminal implements CodeChallenge {
  async getCode() {
    return readline.question("What's the access code? ");
  }
}

type SimpleOrg = {
  Id: string;
  Name: string;
  States: string[];
};

const cookieManager = new CookieManagerInMemory();
if (cookies) {
  cookieManager.updateCookies(cookies.split(";").flatMap(c => cookieFromString(c) ?? []));
}

export async function main() {
  console.log(`Running coverage enhancement... - started at ${new Date().toISOString()}`);
  const startedAt = Date.now();

  const props: SessionManagementConfig = {
    username: cwUsername,
    password: cwPassword,
    cookieManager,
    cwManagementApi: new CommonWellManagementAPI({ cookieManager, baseUrl: cwBaseUrl }),
    codeChallenge: new CodeChallengeFromTerminal(),
    browser: await chromium.launch({
      headless: false,
      slowMo: 100,
    }),
    errorScreenshotToFileSystem: true,
    debug: console.log,
  };

  const cwSession = new SessionManagement(props);
  await cwSession.keepSessionActive();

  const linkPatients = new LinkPatients({
    cwManagementApi: props.cwManagementApi,
    apiUrl: metriportApiBaseUrl,
  });

  try {
    const orgs: SimpleOrg[] = JSON.parse(cqOrgsList);
    console.log(`################################## Total CQ orgs: ${orgs.length}`);

    const chunks = chunk(orgs, CQ_ORG_CHUNK_SIZE);
    chunks.splice(0, downloadProgressIndex);

    for (const [i, orgChunk] of chunks.entries()) {
      const { log } = out(`CHUNK ${i}/${chunks.length}`);
      const orgIds = orgChunk.map(org => org.Id);

      log(`--------------------------------- Starting`);

      try {
        await linkPatients.linkPatientToOrgs({
          cxId,
          cxOrgOID,
          patientIds,
          cqOrgIds: orgIds,
        });
      } catch (error) {
        log(`ERROR - stopped at org chunk ${i + downloadProgressIndex}`, error);
        throw error;
      }
    }
  } finally {
    console.log(`################################## Total time: ${Date.now() - startedAt}ms`);
  }
}

main();
