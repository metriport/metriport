/**
 * Script to query CloudWatch logs for occurrences of "Match: true" over the past two weeks.
 *
 * This script performs the following actions:
 * - Iterates through each day in the past two weeks
 * - Queries CloudWatch logs for the specified log group and each day's time range
 * - Counts the number of times "Match: true" appears in the logs for each day
 * - Outputs the total count per day and the cumulative total
 */

import { queryLogs } from "./query";
import { initDbPool } from "@metriport/core/util/sequelize";
import { QueryTypes } from "sequelize";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import * as fs from "fs";
import * as path from "path";

/**
 * Configuration
 */
const LOG_GROUP_NAME = "/aws/lambda/IHEInboundPatientDiscoveryV2Lambda";
const FILTER_PATTERN = '"Match: true"';
const DAYS_TO_QUERY = 15;

const cxIdMap: Map<string, number> = new Map();
const recentPatientCountMap: Map<string, number> = new Map();
const patientIdSet: Set<string> = new Set();

const CX_IDS: string[] = [];

//eslint-disable-next-line @typescript-eslint/no-explicit-any
function writeResultsToCSV(results: any[], filename: string): void {
  const csvContent = [
    "CX ID,Total Patients Created,Total Patients Matched,Total Patients Matched (Recent),% of Matches (Recent Patients),% of Recent Patients with Matches",
    ...results.map(
      row =>
        `${row.cxId},${row.totalPatientsCreated},${row.totalPatientsMatched},${row.totalPatientsMatchedRecent},${row.percentageOfMatchesWhichAreRecentPatients},${row.percentageOfRecentPatientsWithMatches}`
    ),
  ].join("\n");

  const filePath = path.join(__dirname, filename);
  fs.writeFileSync(filePath, csvContent);
  console.log(`Results written to ${filePath}`);
}

/**
 * Retrieves patient IDs for specified CX IDs created in the last two weeks.
 * @param cxIds Array of customer CX IDs.
 * @returns A map where each key is a CX ID and the value is a set of patient IDs.
 */
async function getRecentPatientIds(cxIds: string[]): Promise<Map<string, Set<string>>> {
  const sqlDBCreds = getEnvVarOrFail("DB_CREDS");
  const sequelize = initDbPool(sqlDBCreds);
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 15);

  const query = `
    SELECT id, cx_id
    FROM patient
    WHERE cx_id IN (:cxIds) AND created_at >= :twoWeeksAgo;
  `;

  try {
    const results = await sequelize.query<{ id: string; cx_id: string }>(query, {
      replacements: { cxIds, twoWeeksAgo },
      type: QueryTypes.SELECT,
    });

    const patientMap: Map<string, Set<string>> = new Map();
    cxIds.forEach(cxId => {
      patientMap.set(cxId, new Set());
    });

    results.forEach(record => {
      const { id, cx_id } = record;
      if (patientMap.has(cx_id)) {
        patientMap.get(cx_id)?.add(id);
      }
    });

    return patientMap;
  } catch (error) {
    console.error("Error querying patients:", error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

/**
 * Utility function to format a date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function base64Decode(encoded: string): string {
  return Buffer.from(encoded, "base64").toString("utf-8");
}
/**
 * Extracts the match data from the log message.
 * @param message The log message string.
 * @returns An object containing the id if found, otherwise undefined.
 */
function extractMatchData(message: string): { id: string } | undefined {
  const idRegex = /"id":\s*"([^"]+)"/;
  const match = idRegex.exec(message);
  if (match && match[1]) {
    return { id: match[1] };
  }
  return undefined;
}

async function main() {
  console.log("Starting log queries for the past two weeks...");

  const recentPatientsMap = await getRecentPatientIds(CX_IDS);

  const today = new Date();
  const results: Record<string, number> = {};
  let cumulativeTotal = 0;

  for (let i = 0; i < DAYS_TO_QUERY; i++) {
    const currentDate = new Date(today);
    currentDate.setUTCDate(today.getUTCDate() - i);
    const startDate = new Date(`${formatDate(currentDate)}T00:00:00Z`).getTime();
    const endDate = new Date(`${formatDate(currentDate)}T23:59:59Z`).getTime();

    try {
      const events = await queryLogs(LOG_GROUP_NAME, FILTER_PATTERN, startDate, endDate);
      const count = events.length;
      results[formatDate(currentDate)] = count;
      cumulativeTotal += count;
      console.log(`Date: ${formatDate(currentDate)} - "Match: true" occurrences: ${count}`);

      // Process each matching event
      events.forEach(eventMessage => {
        try {
          const match = extractMatchData(eventMessage);
          if (match) {
            const decodedId = base64Decode(match.id);
            const parts = decodedId.split("/");
            if (parts.length === 2) {
              const [cxId, patientId] = parts;

              if (!patientIdSet.has(patientId)) {
                patientIdSet.add(patientId);

                const uniquePatientCount = cxIdMap.get(cxId) || 0;
                cxIdMap.set(cxId, uniquePatientCount + 1);

                const recentPatients = recentPatientsMap.get(cxId);
                if (recentPatients && recentPatients.has(patientId)) {
                  const recentCount = recentPatientCountMap.get(cxId) || 0;
                  recentPatientCountMap.set(cxId, recentCount + 1);
                }
              }
            } else {
              console.error(`Unexpected decoded ID format: ${decodedId}`);
            }
          }
        } catch (processingError) {
          console.error("Error processing event message:", processingError);
        }
      });
    } catch (error) {
      console.error(`An error occurred during the query for ${formatDate(currentDate)}:`, error);
      results[formatDate(currentDate)] = 0;
    }
  }

  console.log("\nSummary of Match occurrences over the past two weeks:");
  console.table(results);
  console.log(`\nCumulative total occurrences: ${cumulativeTotal}`);
  console.log(`Total unique Patient IDs matched: ${patientIdSet.size}`);

  const sortedCxIds = Array.from(cxIdMap.entries()).sort((a, b) => b[1] - a[1]);

  const cxIdSummary = sortedCxIds.map(([cxId, count]) => {
    const totalPatientsMatched = count;
    const totalPatientsMatchedRecent = recentPatientCountMap.get(cxId) || 0;
    const totalPatientsCreatedRecent = recentPatientsMap.get(cxId)?.size || 0;

    const percentageOfMatchesWhichAreRecentPatients =
      totalPatientsMatched > 0
        ? ((totalPatientsMatchedRecent / totalPatientsMatched) * 100).toFixed(2) + "%"
        : "0.00%";

    const percentageOfRecentPatientsWithMatches =
      totalPatientsCreatedRecent > 0
        ? ((totalPatientsMatchedRecent / totalPatientsCreatedRecent) * 100).toFixed(2) + "%"
        : "0.00%";

    return {
      cxId,
      totalPatientsCreatedRecent,
      totalPatientsMatched,
      totalPatientsMatchedRecent,
      percentageOfMatchesWhichAreRecentPatients,
      percentageOfRecentPatientsWithMatches,
    };
  });

  console.log("\nCX ID Statistics:");
  console.table(cxIdSummary);
  writeResultsToCSV(cxIdSummary, "cx_id_statistics.csv");

  console.log("Log queries completed.");
}

main();

console.log("Log queries initiated. Waiting for results...");
