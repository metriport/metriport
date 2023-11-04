import { CookieManagerOnSecrets } from "@metriport/core/domain/auth/cookie-management/cookie-manager-on-secrets";
import { CommonWellManagementAPI } from "@metriport/core/external/commonwell/management/api";
import {
  LinkPatients,
  LinkPatientsCommand,
} from "@metriport/core/external/commonwell/management/link-patients";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import * as Sentry from "@sentry/serverless";
import { SQSEvent, SQSRecord } from "aws-lambda";
import { uniq } from "lodash";
import { capture } from "./shared/capture";
import { getEnv, getEnvOrFail } from "./shared/env";

// Keep this as early on the file as possible
capture.init();

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
const linkPatients = new LinkPatients({ cwManagementApi, apiUrl: metriportBaseUrl });

/**
 * Lambda that groups a list of patientIds for a customer, chunks CareQuality Orgs,
 * and send those to another SQS message for processing.
 */
export const handler = Sentry.AWSLambda.wrapHandler(async (event: SQSEvent) => {
  console.log(
    `Running with inputQueueURL: ${inputQueueURL}, ` +
      `cwManagementBaseUrl: ${cwManagementBaseUrl}, ` +
      `cookieSecretArn: ${cookieSecretArn}, ` +
      `metriportBaseUrl: ${metriportBaseUrl}`
  );
  const startedAt = Date.now();

  const records = event.Records;
  if (!records || records.length < 1) {
    console.log(`No records, discarding this event: ${JSON.stringify(event)}`);
    return;
  }
  if (records.length > 1) {
    // This is concerning b/c we implemented error handing considering max one record per invocation.
    // To support more we need to be able to send messages to DLQ individually in caser of error, as well
    // as to remove them once successfully.
    const msg = `Got more than one message, unexpected`;
    console.log(`${msg} - ${records.length} records - will keep processing, though.`);
    capture.message(msg, { extra: { lambdaName, records }, level: "warning" });
  }
  const entries = records.map(recordToEntry);
  validateEntriesFromSingleCustomer(entries);

  for (const entry of entries) {
    console.log(`Linking this entry: ${JSON.stringify(entry)}`);

    await linkPatients.linkPatientToOrgs(entry);

    console.log(`Done.`);
  }
  console.log(`Total time: ${Date.now() - startedAt} ms`);
});

function recordToEntry(record: SQSRecord): LinkPatientsCommand {
  const body = JSON.parse(record.body);
  const cxId = body.cxId;
  const cxOrgOID = body.cxOrgOID;
  const patientIds = body.patientIds;
  const cqOrgIds = body.cqOrgIds;

  if (!cxId) throw new Error(`Missing cxId in body`);

  if (!cxOrgOID) throw new Error(`Missing cxOrgOID in body`);

  if (!patientIds) throw new Error(`Missing patientIds in body`);
  if (Array.isArray(patientIds)) throw new Error(`Invalid patientIds in body`);

  if (!cqOrgIds) throw new Error(`Missing cqOrgIds in body`);
  if (Array.isArray(cqOrgIds)) throw new Error(`Invalid cqOrgIds in body`);

  return { cxId, cxOrgOID, patientIds, cqOrgIds };
}

function validateEntriesFromSingleCustomer(entries: LinkPatientsCommand[]) {
  const distinctOrgOIDs = uniq(entries.map(e => e.cxOrgOID));
  if (distinctOrgOIDs.length > 1) {
    throw new MetriportError(`More than one orgOID in the batch`, undefined, {
      distinctOrgOIDs: distinctOrgOIDs.join(", "),
    });
  }
}
