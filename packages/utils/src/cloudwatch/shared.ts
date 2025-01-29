import { sleep } from "@metriport/shared";
import dayjs from "dayjs";
import fs from "fs";
import { MessageDetails } from "../sqs/peek-dlq-print-details";
import { queryLogs } from "./query";

export type ErrorOutput = {
  ourErrorMessage: string | undefined;
  ourStatus: string | undefined;
  axiosErrorMessage: string | undefined;
  axiosStatus: string | undefined;
  axiosCode: string | undefined;
  axiosTimeout: string | undefined;
};

const fhirServerLogRegex = /Z\s+([a-f0-9-]{36})\s+INFO/;

export function getSortedMessageDetails(filePath: string): MessageDetails[] {
  const messagesBlob = fs.readFileSync(filePath, "utf-8");
  const messages = JSON.parse(messagesBlob) as MessageDetails[];

  const uniqueMessages = Array.from(new Set(messages.map(a => JSON.stringify(a)))).map(str =>
    JSON.parse(str)
  ) as MessageDetails[];

  const sortedMessages = uniqueMessages.sort((a, b) => {
    return dayjs(a.startedAt).isBefore(dayjs(b.startedAt)) ? -1 : 1;
  });

  return sortedMessages;
}
export async function handleSingleMessage({
  logGroupName,
  filterPattern,
  startDate,
  endDate,
}: {
  logGroupName: string;
  filterPattern: string;
  startDate: number;
  endDate: number;
}) {
  console.log("Starting log query...");

  try {
    const simpleEvents = await queryLogs(
      logGroupName,
      `${filterPattern} "INFO"`,
      startDate,
      endDate
    );
    console.log(`Query completed. Total simple events received: ${simpleEvents.length}`);

    const requestId = getRequestId(simpleEvents[0]);
    const errorFilter = `"${requestId}" "ERROR"`;
    const errorLogs = await queryLogs(logGroupName, errorFilter, startDate, endDate);
    const errorDetails = parseFhirConverterErrorLog(errorLogs);

    await sleep(500);
    return { errorDetails, requestId };
  } catch (error) {
    console.error("An error occurred during the query:", error);
  }
}

export function getRequestId(logEvent: string): string {
  const match = logEvent.match(fhirServerLogRegex);
  if (match) {
    const [, requestId] = match;
    if (requestId) return requestId;
  }
  throw new Error("Couldn't identify the requestId");
}

export function parseFhirConverterErrorLog(logEvents: string[]): ErrorOutput[] {
  const results: ErrorOutput[] = [];

  logEvents.forEach(event => {
    const errorResponseObject = extractAndParseObjectFromString(event);
    const errorOutput: ErrorOutput = {
      ourErrorMessage: errorResponseObject.errorMessage,
      ourStatus: errorResponseObject.status,
      axiosErrorMessage: errorResponseObject.cause?.message,
      axiosStatus: errorResponseObject.cause?.status,
      axiosCode: errorResponseObject.cause?.code,
      axiosTimeout: errorResponseObject.cause?.config?.timeout,
    };
    results.push(errorOutput);
  });

  if (!results) throw new Error("No log events found");
  return results;
}

function extractAndParseObjectFromString(largeString: string) {
  // Find the first occurrence of '{'
  const startIndex = largeString.indexOf("{");
  if (startIndex === -1) {
    throw new Error("No object found in the string.");
  }

  // Find the last occurrence of '}'
  const endIndex = largeString.lastIndexOf("}");
  if (endIndex === -1 || endIndex <= startIndex) {
    throw new Error("No complete object found in the string.");
  }

  const jsonString = largeString.substring(startIndex, endIndex + 1);
  try {
    const parsedObject = JSON.parse(jsonString);
    return parsedObject;
  } catch (error) {
    throw new Error(
      "Invalid JSON format. Likely, the error log is so large it didn't fit into one row on CloudWatch."
    );
  }
}
