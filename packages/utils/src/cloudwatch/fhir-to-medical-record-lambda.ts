/**
 * Script to query CloudWatch logs for FHIR to medical record lambda executions.
 *
 * This script performs the following actions:
 * - Queries CloudWatch logs for a specified log group and time range
 * - Parses the log events to extract customer IDs and patient IDs
 * - Groups the results by customer ID
 *
 * To run this script, set:
 * - LOG_GROUP_NAME: The name of the CloudWatch log group to query
 * - FILTER_PATTERN: The filter pattern to apply to the log query
 * - startDate: The start date for the log query
 * - endDate: The end date for the log query
 */

import { queryLogs } from "./query";

const LOG_GROUP_NAME = "";
const FILTER_PATTERN = "";
const startDate = new Date("2024-09-25T00:00:00Z").getTime();
const endDate = new Date("2024-09-26T23:59:59Z").getTime();

function parseLogEvents(logEvents: string[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  logEvents.forEach(event => {
    const match = event.match(/\[cx ([^,]+), patient ([^\]]+)\]/);
    if (match) {
      const [, cxId, patientId] = match;
      if (!result[cxId]) {
        result[cxId] = [];
      }
      result[cxId].push(patientId);
    }
  });

  return result;
}

async function main() {
  console.log("Starting log query...");
  try {
    const events = await queryLogs(LOG_GROUP_NAME, FILTER_PATTERN, startDate, endDate);
    console.log(`Query completed. Total events received: ${events.length}`);
    const parsedResults = parseLogEvents(events);
    console.log("Parsed results:");
    console.log(JSON.stringify(parsedResults, null, 2));
  } catch (error) {
    console.error("An error occurred during the query:", error);
  }
  console.log("Log query completed.");
}

main();

console.log("Log query initiated. Waiting for results...");
