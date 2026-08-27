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
import { endScript, startScript } from "../../utils";

/**
 * Re-converts A03 ADT messages for a CX by sending them through the HL7 notification pipeline.
 *
 * This is useful when the ADT-to-FHIR conversion logic has been updated and you need to
 * reprocess existing ADTs to apply the new mappings (e.g., discharge disposition).
 *
 * Steps:
 * 1. Ensure your .env file has AWS_REGION set
 * 2. Update the cxId constant below
 * 3. Set dryRun to false to actually send the ADTs to the queue
 * 4. Set isSendWebhook based on whether you want webhooks sent
 * 5. Run the script:
 *    ts-node src/hl7v2-notifications/reprocess-adt-conversion-bundles/re-convert-a03-adts.ts
 *
 * Output:
 * - A JSON file with all processed ADTs
 * - Console output with totals
 */

const bucketName = Config.getHl7IncomingMessageBucketName();
const region = Config.getAWSRegion();
Config.getEnvType();
const notificationQueueUrl = Config.getHl7NotificationQueueUrl();

// ⚠️ UPDATE THESE VALUES ⚠️
const cxId = "";
const dryRun = true;
const isSendWebhook = false;
const HIE_NAME = "Bamboo";

type A03AdtMessage = {
  cxId: string;
  patientId: string;
  messageKey: string;
  hl7Message: string;
  messageReceivedTimestamp: string;
  hieName: string;
};

const s3Utils = new S3Utils(region);

async function main() {
  await sleep(50); // Avoid mixing logs with Node
  if (bucketName.toLowerCase().includes("production")) {
    console.log("\n⚠️⚠️⚠️  WARNING: YOU ARE RUNNING AGAINST A PRODUCTION BUCKET  ⚠️⚠️⚠️\n");
  }
  if (notificationQueueUrl.toLowerCase().includes("us-west-1")) {
    console.log("\n⚠️⚠️⚠️  WARNING: YOU ARE RUNNING AGAINST A PRODUCTION QUEUE  ⚠️⚠️⚠️\n");
  }

  const startedAt = await startScript({
    nameOfScript: "re-convert-a03-adts",
    dryRun,
    optionalParams: {
      cxId,
      bucketName,
      region,
      isSendWebhook,
      notificationQueueUrl,
    },
  });

  if (!cxId) {
    console.error("ERROR: Please set the cxId constant in the script");
    process.exit(1);
  }

  console.log(`\nFetching patient folders...`);
  const patientIds = await getAllPatientFolderNames(cxId);
  console.log(`Found ${patientIds.length} patient folders\n`);

  const allA03Adts: A03AdtMessage[] = [];

  for (const patientId of patientIds) {
    const patientA03s = await getA03AdtsFromPatient(cxId, patientId);
    allA03Adts.push(...patientA03s);
  }

  console.log(`\nFound ${allA03Adts.length} A03 ADTs total`);

  let processedCount = 0;
  let errorCount = 0;

  if (!dryRun) {
    console.log(`\nSending ${allA03Adts.length} A03 ADTs to the queue for reprocessing...`);
    const handler = buildHl7NotificationWebhookSender();

    for (const adt of allA03Adts) {
      const params: Hl7NotificationSenderParams = {
        cxId: adt.cxId,
        patientId: adt.patientId,
        message: adt.hl7Message,
        messageReceivedTimestamp: adt.messageReceivedTimestamp,
        hieName: adt.hieName,
        isSendWebhook,
      };

      try {
        await handler.execute(params);
        processedCount++;
        console.log(`[${processedCount}/${allA03Adts.length}] Sent: ${adt.messageKey}`);
      } catch (error) {
        errorCount++;
        console.error(`[ERROR] Failed to send: ${adt.messageKey}`, error);
      }

      await sleep(50); // Here to not overwhelm the queue
    }
  } else {
    console.log(`\n[DRY RUN] Would send ${allA03Adts.length} A03 ADTs to the queue`);
    processedCount = allA03Adts.length;
  }

  const outputDir = "./runs/re-convert-a03-adts";
  makeDir(outputDir);

  const timestamp = buildDayjs().format("YYYY-MM-DD_HH-mm-ss-SSS");
  const outputFileName = `${outputDir}/a03-adts_${cxId}_${timestamp}.json`;

  const outputData = allA03Adts.map(adt => ({
    cxId: adt.cxId,
    patientId: adt.patientId,
    messageKey: adt.messageKey,
    hieName: adt.hieName,
    messageReceivedTimestamp: adt.messageReceivedTimestamp,
  }));

  writeFileContents(outputFileName, JSON.stringify(outputData, null, 2));
  console.log(`\nResults saved to: ${outputFileName}`);

  await endScript({
    nameOfScript: "re-convert-a03-adts",
    startedAt,
    optionalParams: {
      totalA03Adts: allA03Adts.length,
      processedCount,
      errorCount,
      outputFileName,
    },
  });
}

async function getAllPatientFolderNames(cxId: string): Promise<string[]> {
  const objects = await s3Utils.listObjects(bucketName, `${cxId}/`);

  const folderSet = new Set<string>();
  for (const object of objects) {
    if (object.Key) {
      const pathParts = object.Key.split("/");
      if (pathParts.length >= 2 && pathParts[1]) {
        folderSet.add(pathParts[1]);
      }
    }
  }

  return Array.from(folderSet);
}

async function getA03AdtsFromPatient(cxId: string, patientId: string): Promise<A03AdtMessage[]> {
  const results: A03AdtMessage[] = [];
  const objects = await s3Utils.listObjects(bucketName, `${cxId}/${patientId}/`);

  for (const object of objects) {
    if (!object.Key || !object.LastModified) continue;

    const adt = await s3Utils.getFileContentsAsString(bucketName, object.Key);
    const hl7Message = Hl7Message.parse(adt);

    if (!isA03Message(hl7Message)) {
      continue;
    }

    console.log(`Found A03: ${object.Key}`);

    results.push({
      cxId,
      patientId,
      messageKey: object.Key,
      hl7Message: adt,
      messageReceivedTimestamp: object.LastModified.toISOString(),
      hieName: HIE_NAME,
    });
  }

  return results;
}

function isA03Message(hl7Message: Hl7Message): boolean {
  const mshSegment = hl7Message.getSegment("MSH");
  if (!mshSegment) return false;

  const messageType = mshSegment.getField(9)?.toString();
  return messageType?.includes("A03") ?? false;
}

main();
