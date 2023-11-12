import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { CodeChallenge } from "@metriport/core/domain/auth/code-challenge";
import { cookieFromString } from "@metriport/core/domain/auth/cookie-management/cookie-manager";
import { CookieManagerInMemory } from "@metriport/core/domain/auth/cookie-management/cookie-manager-in-memory";
import { TriggerAndQueryDocRefsRemote } from "@metriport/core/domain/document-query/trigger-and-query-remote";
import { PatientUpdaterMetriportAPI } from "@metriport/core/domain/patient/patient-updater-metriport-api";
import { CoverageEnhancerLocal } from "@metriport/core/external/commonwell/cq-bridge/coverage-enhancer-local";
import { CommonWellManagementAPI } from "@metriport/core/external/commonwell/management/api";
import {
  SessionManagement,
  SessionManagementConfig,
} from "@metriport/core/external/commonwell/management/session";
import { getEnvVar, getEnvVarOrFail } from "@metriport/core/util/env-var";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import * as readline from "readline-sync";

dayjs.extend(duration);

// Leaving this separated from the rest as we might need to switch browsers if it fails to get the cookie
// import { chromium as runtime } from "playwright";
import { firefox as runtime } from "playwright";

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

// If it fails to get the cookie, we might need to run this on a "headed" browser = update this to false:
const headless = true;
//const headless = false;

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

const WAIT_BETWEEN_LINKING_AND_DOC_QUERY = dayjs.duration({ seconds: 30 });
const DOC_QUERIES_IN_PARALLEL = 25;
const prefix = "###############################";

class CodeChallengeFromTerminal implements CodeChallenge {
  async getCode() {
    return readline.question("What's the access code? ");
  }
}
const codeChallenge = new CodeChallengeFromTerminal();
const cookieManager = new CookieManagerInMemory();

if (cookies) {
  cookieManager.updateCookies(cookies.split(";").flatMap(c => cookieFromString(c) ?? []));
}

const cwManagementApi = new CommonWellManagementAPI({ cookieManager, baseUrl: cwBaseUrl });
const triggerAndQueryDocRefs = new TriggerAndQueryDocRefsRemote(metriportApiBaseUrl);
const patientUpdater = new PatientUpdaterMetriportAPI(metriportApiBaseUrl);
const coverageEnhancer = new CoverageEnhancerLocal(
  cwManagementApi,
  patientUpdater,
  triggerAndQueryDocRefs,
  prefix
);

export async function main() {
  console.log(`Running coverage enhancement... - started at ${new Date().toISOString()}`);
  const startedAt = Date.now();

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
    debug: console.log,
  };

  const cwSession = new SessionManagement(props);
  await cwSession.initSession();

  await coverageEnhancer.enhanceCoverage({
    cxId,
    orgOID: cxOrgOID,
    patientIds,
    startedAt,
    fromOrgChunkPos: downloadProgressIndex,
    config: {
      waitBetweenLinkingAndDocQuery: WAIT_BETWEEN_LINKING_AND_DOC_QUERY,
      docQueriesInParallel: DOC_QUERIES_IN_PARALLEL,
    },
  });

  const duration = Date.now() - startedAt;
  const durationMin = dayjs.duration(duration).asMinutes();
  console.log(`${prefix} Total time: ${duration} ms / ${durationMin} min`);

  // for some reason it was hanging when updating this script, this fixes it
  process.exit(0);
}

main();
