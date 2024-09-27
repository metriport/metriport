/**
 * Script to query CloudWatch logs for FHIR to bundle lambda executions.
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
const FILTER_PATTERN = "Failed to get FHIR resources";
const startDate = new Date("2024-09-26T00:00:00Z").getTime();
const endDate = new Date("2024-09-27T23:59:59Z").getTime();

function parseLogEvents(logEvents: string[]): Record<string, string[]> {
  const result: Record<string, Set<string>> = {};

  logEvents.forEach(event => {
    const match = event.match(/\[cx ([^,]+), patient ([^\s,]+)/);
    if (match) {
      const [, cxId, patientId] = match;
      if (!result[cxId]) {
        result[cxId] = new Set();
      }
      result[cxId].add(patientId);
    }
  });

  const finalResult: Record<string, string[]> = {};
  for (const cxId in result) {
    finalResult[cxId] = Array.from(result[cxId]);
  }

  return finalResult;
}

async function main() {
  console.log("Starting log query...");
  try {
    const events = await queryLogs(LOG_GROUP_NAME, FILTER_PATTERN, startDate, endDate);
    console.log(`Query completed. Total events received: ${events.length}`);
    const parsedResults = parseLogEvents(events);
    console.log("Parsed results:");
    console.log(JSON.stringify(parsedResults, null, 2));

    // Count unique patient IDs per customer ID
    const counts: Record<string, number> = {};
    for (const cxId in parsedResults) {
      counts[cxId] = parsedResults[cxId].length; // Count unique patient IDs
    }
    console.log("Counts of unique patient IDs per customer ID:");
    console.log(JSON.stringify(counts, null, 2));
  } catch (error) {
    console.error("An error occurred during the query:", error);
  }
  console.log("Log query completed.");
}

main();

console.log("Log query initiated. Waiting for results...");
