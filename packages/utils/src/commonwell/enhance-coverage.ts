import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { CodeChallenge } from "@metriport/core/domain/auth/code-challenge";
import { CookieManagerInMemory } from "@metriport/core/domain/auth/cookie-management/cookie-manager-in-memory";
import { CommonWellManagementAPI } from "@metriport/core/external/commonwell/management/api";
import { LinkPatients } from "@metriport/core/external/commonwell/management/link-patients";
import {
  SessionManagement,
  SessionManagementConfig,
} from "@metriport/core/external/commonwell/management/session";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import * as fs from "fs";
import { chunk } from "lodash";
import * as readline from "readline-sync";

dayjs.extend(duration);

/**
 * Script to run on local environment the code that enhances coverage @ CommonWell.
 *
 * - populate the array `patientIds` with the patients' IDs you want to link to the CQ orgs.
 * - populate the env vars below with the values for your environment.
 *
 * Logs-in using the credentials on the env vars and ask for the code challenge through
 * the terminal if it's needed.
 */

const patientIds: string[] = ["..."];

/**
 * If the cookie gets outdated during the execution and the processing fails, you'll need to
 * set the index below to the last one that was successful.
 */
const downloadProgressIndex = 0;

const cwBaseUrl = getEnvVarOrFail("CW_URL");
const cwUsername = getEnvVarOrFail("CW_USERNAME");
const cwPassword = getEnvVarOrFail("CW_PASSWORD");
const cxId = getEnvVarOrFail("CX_ID");
const cxOrgOID = getEnvVarOrFail("ORG_OID");
const metriportBaseUrl = getEnvVarOrFail("API_URL");

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
const cwManagementApi = new CommonWellManagementAPI({ cookieManager, baseUrl: cwBaseUrl });
const props: SessionManagementConfig = {
  username: cwUsername,
  password: cwPassword,
  cookieManager,
  cwManagementApi,
  codeChallenge: new CodeChallengeFromTerminal(),
  headless: false,
};
const linkPatients = new LinkPatients({ cwManagementApi, apiUrl: metriportBaseUrl });

export async function main() {
  console.log(`Testing Coverage Enhancement...`);

  const cwSession = new SessionManagement(props);
  await cwSession.keepSessionActive();

  const startedAt = Date.now();
  try {
    const orgs: SimpleOrg[] = JSON.parse(cqOrgsList);
    console.log(`################################## Total CQ orgs: ${orgs.length}`);

    const chunks = chunk(orgs, CQ_ORG_CHUNK_SIZE);
    chunks.splice(0, downloadProgressIndex);

    for (const [i, orgChunk] of chunks.entries()) {
      const { log } = out(`CHUNK ${i}/${chunks.length}`);
      log(`--------------------------------- Starting`);
      const orgIds = orgChunk.map(org => org.Id);

      await linkPatients.linkPatientToOrgs({
        cxId,
        cxOrgOID,
        patientIds,
        cqOrgIds: orgIds,
      });
    }
  } finally {
    console.log(`################################## Total time: ${Date.now() - startedAt}ms`);
  }
}

main();
