import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { S3Utils } from "@metriport/core/external/aws/s3";
import { getEnvVarOrFail, sleep } from "@metriport/shared";
import { PatientImportJobStatus } from "@metriport/shared/domain/patient/patient-import/status";
import { BulkPatientImportWebhookRequest, WebhookMetadata } from "@metriport/shared/medical";
import dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";
import { sendPayload } from "../../../api/src/command/webhook/webhook";
import { CreateWebhookRequestCommand } from "../../../api/src/command/webhook/webhook-request";
import { elapsedTimeAsStr } from "../shared/duration";

/**
 * Temporary script to send a webhook request as the result of a bulk patient import.
 * This is a temporary script to be used until the bulk patient import is fully integrated with the webhook.
 */

// Update to "processing" if you want to send the webhook when the import is initialized
const bulkPatientCreateStatus: PatientImportJobStatus = "completed";

const cxId = getEnvVarOrFail("CX_ID");
const jobId = getEnvVarOrFail("PATIENT_IMPORT_JOB_ID");
const webhookUrl = getEnvVarOrFail("CX_WH_URL");
const webhookKey = getEnvVarOrFail("METRIPORT_WH_KEY");
const s3BucketName = getEnvVarOrFail("PATIENT_IMPORT_BUCKET_NAME");
const awsRegion = getEnvVarOrFail("AWS_REGION");

// Update if needed
const resultFileKeyName = `patient-import/cxid=${cxId}/jobid=${jobId}/files/result.csv`;

const presignedResultUrlDuration = dayjs.duration(10, "minutes");
const confirmationTime = dayjs.duration(10, "seconds");
const s3Utils = new S3Utils(awsRegion);

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  console.log(`############## Started at ${new Date(startedAt).toISOString()} ##############`);

  const presignedUrl =
    bulkPatientCreateStatus === "completed"
      ? await s3Utils.getSignedUrl({
          bucketName: s3BucketName,
          fileName: resultFileKeyName,
          durationSeconds: presignedResultUrlDuration.asSeconds(),
        })
      : undefined;
  const payload: Omit<BulkPatientImportWebhookRequest, "meta"> = {
    bulkPatientCreate: {
      requestId: jobId,
      status: bulkPatientCreateStatus,
      ...(presignedUrl && { result: presignedUrl }),
    },
  };
  const createWebhookRequestCmd: CreateWebhookRequestCommand = {
    cxId,
    requestId: jobId,
    type: "medical.bulk-patient-create",
    payload,
  };

  const webhookRequest = {
    ...createWebhookRequestCmd,
    id: uuidv4(),
    status: "success",
    createdAt: new Date(),
  };

  const meta: WebhookMetadata = {
    messageId: webhookRequest.id,
    when: dayjs(webhookRequest.createdAt).toISOString(),
    type: webhookRequest.type,
  };
  const fullPayload = {
    meta,
    ...payload,
  };

  console.log(`Will send WH in ${confirmationTime.asSeconds()} seconds...`);
  console.log(`- URL: ${webhookUrl}`);
  console.log(`- Payload to send: ${JSON.stringify(fullPayload, undefined, 2)}`);
  await sleep(confirmationTime.asMilliseconds());

  const res = await sendPayload(fullPayload, webhookUrl, webhookKey);
  console.log(`>>> res: ${JSON.stringify(res, undefined, 2)}`);

  console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
}

main();
