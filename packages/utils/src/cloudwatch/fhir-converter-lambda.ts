import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { parseFilePath } from "@metriport/core/domain/filename";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import fs from "fs";
import { getSortedMessageDetails, handleSingleMessage } from "./shared";

/**
 * This script queries the logs of the FHIR Converter Lambda for each message in the DLQ.
 *
 * !!! PREREQUISITE !!!
 * Run the `peek-dlq-print-details.ts` script to get the messages from the DLQ.
 * Put the absolute path to the resulting file in peekDlqOutput.
 *
 * For each message in the DLQ, the script will first query the logs using the file name from the message to get the request ID.
 * Then, using the request ID, it will get all the error logs for that request and save them in a file.
 *
 * All files are stored in the `runs/fhir-converter-lambda` folder in a sorted manner (from oldest to newest).
 *
 * Set `toDownloadFiles` to true if you want to download the problematic files from the dlq to your PHI folder for a closer look.
 *
 */

const peekDlqOutputFilePath = "";
const LOG_GROUP_NAME = "/aws/lambda/FHIRConverter2Lambda";
const THREE_HOUR_WINDOW_MS = 3 * 60 * 60 * 1000;
const startDate = new Date().toISOString();
const outputFolder = `runs/fhir-converter-lambda/${startDate}`;
const userName = "";
const downloadFolder = `/Users/${userName}/Documents/phi/dlq/${startDate}`;
const toDownloadFiles = false;

async function main() {
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }

  const sortedMessages = getSortedMessageDetails(peekDlqOutputFilePath);

  const errorResults = [];

  for (const [index, message] of sortedMessages.entries()) {
    const startTime = new Date(message.startedAt).getTime();
    const endTime = startTime + THREE_HOUR_WINDOW_MS;

    const errorDetailsResult = await handleSingleMessage({
      logGroupName: LOG_GROUP_NAME,
      filterPattern: `"${message.fileName}"`,
      startDate: startTime,
      endDate: endTime,
    });

    errorResults.push({
      ...errorDetailsResult,
      ...message,
    });

    console.log(`Log query completed for index ${index}`);
  }

  if (toDownloadFiles) {
    const region = getEnvVarOrFail("AWS_REGION");
    const medicalDocumentsBucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
    const s3Utils = new S3Utils(region);
    errorResults.forEach(async e => {
      const doc = await s3Utils.downloadFile({
        key: e.fileName,
        bucket: medicalDocumentsBucketName,
      });
      const doc64 = Buffer.from(doc).toString();

      const fileParts = parseFilePath(e.fileName);
      if (!fileParts) return;

      const downloadPath = `${downloadFolder}/${fileParts.cxId}/${fileParts.patientId}`;
      if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath, { recursive: true });
      }

      fs.writeFileSync(`${downloadPath}/${fileParts.fileId}`, doc64);
    });
  }

  fs.appendFileSync(`${outputFolder}/results.json`, JSON.stringify(errorResults, null, 2));
}

main();
