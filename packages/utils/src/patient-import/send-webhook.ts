import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { S3Utils } from "@metriport/core/external/aws/s3";
import { sleep } from "@metriport/shared";
import { WebhookBulkPatientImportPayload, WebhookMetadata } from "@metriport/shared/medical";
import dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";
import { sendPayload } from "../../../api/src/command/webhook/webhook";
import { CreateWebhookRequestCommand } from "../../../api/src/command/webhook/webhook-request";
import { elapsedTimeAsStr } from "../shared/duration";
import { PatientImportStatus } from "@metriport/shared/domain/patient/patient-import/types";

/**
 * Temporary script to send a webhook request as the result of a bulk patient import.
 * This is a temporary script to be used until the bulk patient import is fully integrated with the webhook.
 */

// Update these
const cxId = "";
const jobId = "";
const webhookUrl = "";
const webhookKey = "";
// Update to "processing" if you want to send the webhook when the import is initialized
const bulkPatientCreateStatus: PatientImportStatus = "completed";

// Update if needed
const resultFileKeyName = `patient-import/cxid=${cxId}/jobid=${jobId}/files/result.csv`;
const s3BucketName = "metriport-patient-import-production";
const awsRegion = "us-west-1";

const presignedResultUrlDuration = dayjs.duration(3, "minutes");

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
  const payload: Omit<WebhookBulkPatientImportPayload, "meta"> = {
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

  const res = await sendPayload(fullPayload, webhookUrl, webhookKey);
  console.log(`>>> res: ${JSON.stringify(res, undefined, 2)}`);

  console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
}

main();
