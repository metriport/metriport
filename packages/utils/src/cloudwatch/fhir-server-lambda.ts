import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { sleep } from "@metriport/shared";
import dayjs from "dayjs";
import fs from "fs";
import { MessageDetails } from "../sqs/peek-dlq-print-details";
import { queryLogs } from "./query";

/**
 * This script queries the logs of the FHIR Server Lambda for each message in the DLQ.
 *
 * !!! PREREQUISITE !!!
 * Run the `peek-dlq-print-details.ts` script to get the messages from the DLQ.
 * Put the absolute path to the resulting file in peekDlqOutput.
 *
 * For each message in the DLQ, the script will first query the logs using the file name from the message to get the request ID.
 * Then, using the request ID, it will get all the logs for that request and save them in a file.
 *
 * All files are stored in the `runs/fhir-to-server-lambda` folder in a sorted manner (from oldest to newest).
 *
 */

const peekDlqOutput = "";
const LOG_GROUP_NAME = "/aws/lambda/FHIRServerLambda";
const fhirServerLogRegex = /Z\s+([a-f0-9-]{36})\s+INFO/;
const startDate = Date.now();
const outputFolder = `runs/fhir-to-server-lambda/${startDate}`;

function parseLogEvents(logEvents: string[]): string {
  let result: string | undefined;

  logEvents.forEach(event => {
    const match = event.match(fhirServerLogRegex);
    if (match) {
      const [, cxId] = match;
      result = cxId;
    }
  });

  if (!result) throw new Error("No log events found");
  return result;
}

async function handleSingleMessage({
  logGroupName,
  filterPattern,
  startDate,
  endDate,
  index,
}: {
  logGroupName: string;
  filterPattern: string;
  startDate: number;
  endDate: number;
  index: number;
}) {
  console.log("Starting log query...");
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }

  try {
    const simpleEvents = await queryLogs(logGroupName, filterPattern, startDate, endDate);
    console.log(`Query completed. Total simple events received: ${simpleEvents.length}`);
    const newFilterString = parseLogEvents(simpleEvents);
    const detailedEvents = await queryLogs(
      logGroupName,
      `"${newFilterString}"`,
      startDate,
      endDate
    );
    fs.writeFileSync(
      `${outputFolder}/${index}_${newFilterString}.txt`,
      JSON.stringify(detailedEvents, null, 2)
    );
    await sleep(1000);
  } catch (error) {
    console.error("An error occurred during the query:", error);
  }
  console.log(`Log query completed for index ${index}`);
}

async function playground() {
  const messagesBlob = fs.readFileSync(peekDlqOutput, "utf-8");
  const messages = JSON.parse(messagesBlob) as MessageDetails[];
  // deduplicate messages by all contents
  const uniqueMessages = Array.from(new Set(messages.map(a => JSON.stringify(a)))).map(str =>
    JSON.parse(str)
  ) as MessageDetails[];

  const updatedMessages = uniqueMessages.sort((a, b) => {
    return dayjs(a.startedAt).isBefore(dayjs(b.startedAt)) ? -1 : 1;
  });

  for (const [index, message] of updatedMessages.entries()) {
    const startTime = new Date(message.startedAt).getTime();
    // End time = startTime + 3 hours
    const endTime = startTime + 3 * 60 * 60 * 1000;

    await handleSingleMessage({
      logGroupName: LOG_GROUP_NAME,
      filterPattern: `"${message.fileName}"`,
      startDate: startTime,
      endDate: endTime,
      index: index + 1,
    });
  }
}

playground();
