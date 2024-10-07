import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
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
 */

const peekDlqOutput =
  "/Users/ramilgaripov/Desktop/metriport/full_stack/metriport/packages/utils/fhir-converter-dlq-oct4.json";
const LOG_GROUP_NAME = "/aws/lambda/FHIRConverter2Lambda";
const THREE_HOUR_WINDOW_MS = 3 * 60 * 60 * 1000;
const startDate = Date.now();
const outputFolder = `runs/fhir-converter-lambda/${startDate}`;

async function main() {
  const sortedMessages = getSortedMessageDetails(peekDlqOutput);

  for (const [index, message] of sortedMessages.entries()) {
    const startTime = new Date(message.startedAt).getTime();
    const endTime = startTime + THREE_HOUR_WINDOW_MS;

    await handleSingleMessage({
      logGroupName: LOG_GROUP_NAME,
      filterPattern: `"${message.fileName}"`,
      startDate: startTime,
      endDate: endTime,
      index: index + 1,
      outputFolder,
    });
  }
}

main();
