import { S3Utils } from "@metriport/core/external/aws/s3";
import * as Sentry from "@sentry/serverless";
import { SQSEvent } from "aws-lambda";
import { chunk } from "lodash";
import { capture } from "./shared/capture";
import { getEnv, getEnvOrFail } from "./shared/env";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnv("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvOrFail("AWS_REGION");
// Set by us
const inputQueueURL = getEnvOrFail("INPUT_QUEUE_URL");
const outputQueueURL = getEnvOrFail("OUTPUT_QUEUE_URL");
const orgListS3BucketName = getEnvOrFail("ORG_LIST_S3_BUCKET");
const orgListS3Key = getEnvOrFail("ORG_LISTS_S3_KEY");

const CQ_ORG_CHUNK_SIZE = 50;

type SimpleOrg = {
  Id: string;
  Name: string;
  States: string[];
};

let orgs: SimpleOrg[] = [];
async function loadOrgList(): Promise<void> {
  const s3Utils = new S3Utils(region);
  const cqOrgsAsString = await s3Utils.getFileContentsAsString("test", "test");
  orgs = JSON.parse(cqOrgsAsString) as SimpleOrg[];
  if (!orgs) throw new Error(`Couldn't retrieve org list from S3`);
}

/**
 * Lambda that groups a list of patientIds for a customer, chunks CareQuality Orgs,
 * and send those to another SQS message for processing.
 */
export const handler = Sentry.AWSLambda.wrapHandler(async (event: SQSEvent) => {
  console.log(
    `Running with inputQueueURL: ${inputQueueURL}, ` +
      `outputQueueURL: ${outputQueueURL}, ` +
      `orgListS3BucketName: ${orgListS3BucketName}, ` +
      `orgListS3Key: ${orgListS3Key}`
  );
  const startedAt = Date.now();

  const records = event.Records;
  if (!records || records.length < 1) {
    console.log(`No records, discarding this event: ${JSON.stringify(event)}`);
    return;
  }

  try {
    if (!orgs) await loadOrgList();
    console.log(`Total orgs: ${orgs.length}`);

    // get patients
    // TODO 1195 map this to the patientIds
    const patientIds = records;
    // make sure they're all from the same customer
    // console.log(`Total patients: ${patients.length}`);

    const chunks = chunk(orgs, CQ_ORG_CHUNK_SIZE);
    console.log(`Total chunks: ${chunks.length}`);

    for (const [i, orgChunk] of chunks.entries()) {
      const orgIds = orgChunk.map(org => org.Id);
      // post a message to the output queue
      console.log(
        `${i}| ...would post a message on SQS with ${orgIds.length} orgs and ${patientIds.length} patients`
      );
    }
  } catch (error) {
    console.log(`Error`, error);
    capture.error(error, { extra: { lambdaName, error } });
    throw error;
  } finally {
    console.log(`Total time: ${Date.now() - startedAt}ms`);
  }
});
