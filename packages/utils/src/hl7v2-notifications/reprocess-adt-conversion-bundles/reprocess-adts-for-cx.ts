/* eslint-disable no-useless-escape */
import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top

import { Hl7Message } from "@medplum/core";
import { Hl7NotificationSenderParams } from "@metriport/core/command/hl7-notification/hl7-notification-webhook-sender";
import { buildHl7NotificationWebhookSender } from "@metriport/core/command/hl7-notification/hl7-notification-webhook-sender-factory";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { Config } from "@metriport/core/util/config";
import { makeDir, writeFileContents } from "@metriport/core/util/fs";
import { sleep } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";

/**
 * Reprocesses ADTs for a list of CXs
 * This will find all adts for a cx and send them to the webhook for reprocessing
 *  ⚠️⚠️⚠️ THIS ONLY WORKS WITH KONZA FOR NOW ⚠️⚠️⚠️
 *
 * Steps:
 * 1. Ensure your .env file has the required AWS and bucket configuration (AWS_REGION)
 * 2. Update the listOfCxIds array on line 20 with the CX IDs to process
 * 2.5. Set dryRun to false to actually send the adts to the webhook
 * 3. Run the script:
 *    npx ts-node src/hl7v2-notifications/reprocess-adt-conversion-bundles/reprocess-adts-for-cx.ts
 *
 * Usage:
 * Run with: ts-node src/hl7v2-notifications/reprocess-adt-conversion-bundles/reprocess-adts-for-cx.ts
 */
const bucketName = Config.getHl7IncomingMessageBucketName();
const region = Config.getAWSRegion();
Config.getHl7NotificationQueueUrl(); // If running for realsies, comment out otherwise.

// ⚠️ THIS ONLY WORKS WITH KONZA ⚠️
const listOfCxIds: string[] = [];
const dryRun = true;

type IdentifiedMessage = {
  cxId: string;
  ptId: string;
  hl7Message: string;
  messageReceivedTimestamp: string;
  hieName: string;
};

const s3Utils = new S3Utils(region);
async function reprocessAdtsForCxs() {
  await sleep(50); // Avoid mixing logs with Node
  console.log(`Getting all ADTs for cxs`);
  const allAdts = await getAllAdtsForCxs();
  console.log(`Found ${allAdts.length} ADTs`);

  for (const adt of allAdts) {
    const params: Hl7NotificationSenderParams = {
      cxId: adt.cxId,
      patientId: adt.ptId,
      message: adt.hl7Message,
      messageReceivedTimestamp: adt.messageReceivedTimestamp,
      hieName: adt.hieName,
    };
    if (!dryRun) {
      const handler = buildHl7NotificationWebhookSender();
      await handler.execute(params);
    }
    console.log(`Processed ${adt.cxId} - ${adt.ptId}`);
    await sleep(50); // Even though theres a sqs queue, we still don't want to overwhelm it
  }

  const fileName = `./runs/send-hl7-message-to-webhook/processed_adts_${buildDayjs().format(
    "YYYY-MM-DD_HH-mm-ss-SSS"
  )}.json`;

  makeDir("./runs/send-hl7-message-to-webhook");

  writeFileContents(fileName, JSON.stringify(allAdts, null, 2));
  console.log(`Wrote ${allAdts.length} ADTs to ${fileName}`);
}

async function getAllAdtsForCxs(): Promise<IdentifiedMessage[]> {
  const allAdts: IdentifiedMessage[] = [];
  for (const cxId of listOfCxIds) {
    const cxAdts = await getAllAdtsFromCx(cxId);
    allAdts.push(...cxAdts);
  }

  return allAdts;
}

async function getAllAdtsFromCx(cxId: string): Promise<IdentifiedMessage[]> {
  const allAdts: IdentifiedMessage[] = [];
  const listOfPatients = await getAllPatientFolderNames(cxId);
  for (const ptId of listOfPatients) {
    const ptAdts = await getAllAdtsFromPt(cxId, ptId);
    allAdts.push(...ptAdts);
  }
  return allAdts;
}

async function getAllPatientFolderNames(cxId: string): Promise<string[]> {
  try {
    const objects = await s3Utils.listObjects(bucketName, `${cxId}/`);

    const folderSet = new Set<string>();
    for (const object of objects) {
      if (object.Key) {
        const pathParts = object.Key.split("/");
        if (pathParts.length >= 2) {
          folderSet.add(pathParts[1]);
        }
      }
    }

    return Array.from(folderSet);
  } catch (error) {
    console.error(`Error getting patient folders for cxId ${cxId}:`, error);
    return [];
  }
}

async function getAllAdtsFromPt(cxId: string, ptId: string): Promise<IdentifiedMessage[]> {
  const allAdts: IdentifiedMessage[] = [];
  const objects = await s3Utils.listObjects(bucketName, `${cxId}/${ptId}/`);

  for (const object of objects) {
    if (!object.Key) continue;

    const adt = await s3Utils.getFileContentsAsString(bucketName, object.Key);
    const hl7Message = Hl7Message.parse(adt);
    const hieName = getHieNameFromMessage(hl7Message);
    if (!hieName) {
      continue;
    }
    if (hieName !== "KONZA") {
      console.log(`Skipping ${object.Key} because it's not from Konza`);
      continue;
    }
    console.log(`Found konza adt ${object.Key}`);
    const lastModified = object.LastModified;
    if (!lastModified) {
      continue;
    }
    const fileTimestamp = lastModified.toISOString();

    allAdts.push({
      cxId,
      ptId,
      hl7Message: adt,
      messageReceivedTimestamp: fileTimestamp,
      hieName: "Konza",
    });
  }
  return allAdts;
}

function getHieNameFromMessage(hl7Message: Hl7Message): string | undefined {
  const mshSegment = hl7Message.getSegment("MSH");
  if (!mshSegment) {
    return undefined;
  }
  const hieField = mshSegment.getField(3);
  if (!hieField) {
    return undefined;
  }
  const hieName = hieField.toString();
  return hieName;
}

reprocessAdtsForCxs();
