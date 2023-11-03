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
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getEnvVar, getEnvVarOrFail } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import * as fs from "fs";
import { chunk } from "lodash";
import * as readline from "readline-sync";
import { queryDocsForPatient } from "./doc-query-shared";

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
const apiKey = getEnvVarOrFail("API_KEY");

const cqOrgsList = fs.readFileSync(`${__dirname}/cq-org-list.json`, "utf8");
const CQ_ORG_CHUNK_SIZE = 50;
const DOC_QUERIES_IN_PARALLEL = 25;

/**
 * Code to run this on local environment.
 */
class CodeChallengeFromTerminal implements CodeChallenge {
  async getCode() {
    return readline.question("What's the access code? ");
  }
}
const codeChallenge = new CodeChallengeFromTerminal();
const cookieManager = new CookieManagerInMemory();
/**
 * Code to run this on a cloud environment, like EC2.
 */
// const region = getEnvVarOrFail("AWS_REGION");
// const notificationUrl = getEnvVarOrFail("SLACK_NOTIFICATION_URL");
// const cookiesSecretArn = getEnvVarOrFail("CW_COOKIES_SECRET_ARN");
// const cookieManager = new CookieManagerOnSecrets(cookiesSecretArn, region);
// const codeChallengeSecretArn = getEnvVarOrFail("CW_CODE_CHALLENGE_SECRET_ARN");
// const codeChallenge = new CodeChallengeFromSecretManager(
//   codeChallengeSecretArn,
//   region,
//   notificationUrl
// );

if (cookies) {
  cookieManager.updateCookies(cookies.split(";").flatMap(c => cookieFromString(c) ?? []));
}

const cwManagementApi = new CommonWellManagementAPI({ cookieManager, baseUrl: cwBaseUrl });

type SimpleOrg = {
  Id: string;
  Name: string;
  States: string[];
};

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
    console.log(
      `################################## Patient linking time: ${Date.now() - startedAt} ms`
    );
  }

  console.log(
    `################################## Triggering doc query... - started at ${new Date().toISOString()}`
  );
  const dqStartedAt = Date.now();

  await executeAsynchronously(
    patientIds,
    async (patientId: string) => {
      const { docsFound } = await queryDocsForPatient({
        cxId,
        patientId,
        apiUrl: metriportApiBaseUrl,
        apiKey,
      });
      console.log(`Done doc query for patient ${patientId}, found ${docsFound} docs`);
    },
    {
      numberOfParallelExecutions: DOC_QUERIES_IN_PARALLEL,
    }
  );
  console.log(`################################## Doc query time: ${Date.now() - dqStartedAt} ms`);

  const duration = Date.now() - startedAt;
  const durationMin = dayjs.duration(duration).asMinutes();
  console.log(`################################## Total time: ${duration} ms / ${durationMin} min`);

  // for some reason it was hanging when updating this script, this fixes it
  process.exit(0);
}

main();
