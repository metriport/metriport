import { CookieManagerOnSecrets } from "@metriport/core/domain/auth/cookie-management/cookie-manager-on-secrets";
import { PatientUpdaterMetriportAPI } from "@metriport/core/command/patient-updater-metriport-api";
import { Input } from "@metriport/core/external/commonwell/cq-bridge/cq-link-patients";
import { CommonWellManagementAPI } from "@metriport/core/external/commonwell/management/api";
import { LinkPatients } from "@metriport/core/external/commonwell/management/link-patients";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { sleep } from "@metriport/core/util/sleep";
import * as Sentry from "@sentry/serverless";
import { SQSEvent, SQSRecord } from "aws-lambda";
import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import stringify from "json-stringify-safe";
import { capture } from "./shared/capture";
import { getEnv, getEnvOrFail, isProduction } from "./shared/env";

dayjs.extend(duration);

// TODO 1195 Decide whether to keep this lambda and enable it or keep logic on API and remove this
// TODO 1195 Decide whether to keep this lambda and enable it or keep logic on API and remove this
// TODO 1195 Decide whether to keep this lambda and enable it or keep logic on API and remove this
// TODO 1195 Decide whether to keep this lambda and enable it or keep logic on API and remove this
// TODO 1195 Decide whether to keep this lambda and enable it or keep logic on API and remove this
// TODO 1195 Decide whether to keep this lambda and enable it or keep logic on API and remove this

// Keep this as early on the file as possible
capture.init();

const TIME_BETWEEN_CQ_LINK_AND_DOC_QUERY = dayjs.duration({ seconds: 30 });

// Automatically set by AWS
const lambdaName = getEnv("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvOrFail("AWS_REGION");
// Set by us
const inputQueueURL = getEnvOrFail("INPUT_QUEUE_URL");
const cwManagementBaseUrl = getEnvOrFail("CW_MANAGEMENT_URL");
const cookieSecretArn = getEnvOrFail("COOKIE_SECRET_ARN");
const metriportBaseUrl = getEnvOrFail("API_URL");

const cookieManager = new CookieManagerOnSecrets(cookieSecretArn, region);
const cwManagementApi = new CommonWellManagementAPI({
  cookieManager,
  baseUrl: cwManagementBaseUrl,
});
const patientUpdater = new PatientUpdaterMetriportAPI(metriportBaseUrl);
const linkPatients = new LinkPatients(cwManagementApi, patientUpdater);

/**
 * Lambda that processes each "chunk" of CQ orgs received as param, updating CW's include list
 * with those and triggering an update for all patients in the patientIds param.
 */
export const handler = Sentry.AWSLambda.wrapHandler(async (event: SQSEvent) => {
  console.log(
    `Running with inputQueueURL: ${inputQueueURL}, ` +
      `cwManagementBaseUrl: ${cwManagementBaseUrl}, ` +
      `cookieSecretArn: ${cookieSecretArn}, ` +
      `metriportBaseUrl: ${metriportBaseUrl}`
  );
  const startedAt = Date.now();
  try {
    const records = event.Records;
    if (!records || records.length < 1) {
      console.log(`No records, discarding this event: ${JSON.stringify(event)}`);
      return;
    }
    if (records.length > 1) {
      const msg = `Got more than one message, unexpected`;
      console.log(`${msg} - ${records.length} records`);
      throw new MetriportError(msg, undefined, { lambdaName, records: stringify(records) });
    }
    const record = records[0];
    if (!record) return;

    const entry = recordToEntry(record);
    console.log(`Linking this entry: ${stringify(entry)}`);

    if (entry.done) {
      console.log(`Completing Enhanced Coverage for this batch of patients`);
      console.log(`Giving some time to increase chances of cache being updated @ CW...`);
      await sleep(TIME_BETWEEN_CQ_LINK_AND_DOC_QUERY.asMilliseconds());
      console.log(`Notifying our API EC is completed for this batch...`);
      await completeEnhancedCoverage(entry.cxId, entry.patientIds);
      return;
    }

    if (!isProduction()) {
      console.log(`--> skipping actual linking b/c we're not on prod`);
      return;
    }
    await linkPatients.linkPatientsToOrgs(entry);

    console.log(`Done.`);
  } finally {
    console.log(`Total time: ${Date.now() - startedAt} ms`);
  }
});

async function completeEnhancedCoverage(cxId: string, patientIds: string[]): Promise<void> {
  await axios.post(`${metriportBaseUrl}/enhance-coverage/completed`, {
    cxId,
    patientIds,
    cqLinkStatus: "linked",
  });
}

function recordToEntry(record: SQSRecord): Input {
  const body = JSON.parse(record.body);

  const cxId = body.cxId;
  if (!cxId) throw new Error(`Missing cxId in body`);

  const cxOrgOID = body.cxOrgOID;
  if (!cxOrgOID) throw new Error(`Missing cxOrgOID in body`);

  const patientIds = body.patientIds;
  if (!patientIds) throw new Error(`Missing patientIds in body`);
  if (Array.isArray(patientIds)) throw new Error(`Invalid patientIds in body`);

  const cqOrgIds = body.cqOrgIds;
  if (!cqOrgIds) throw new Error(`Missing cqOrgIds in body`);
  if (Array.isArray(cqOrgIds)) throw new Error(`Invalid cqOrgIds in body`);

  const done = body.done;
  if (done == undefined) throw new Error(`Missing 'done' in body`);

  if (done) return { cxId, cxOrgOID, patientIds, done };
  return { cxId, cxOrgOID, patientIds, cqOrgIds, done };
}
