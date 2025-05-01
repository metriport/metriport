import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { QueryTypes } from "sequelize";
import { buildDayjs } from "@metriport/shared/common/date";
import fs from "fs";
import { ISO_DATE } from "@metriport/shared/common/date";
import { getXcpdStatsForDay, aggregateNonXcpdErrRespByMonth } from "./xcpd-stats";
import { getXcaDqStatsForDay } from "./xca-dq-stats";
import { getXcaDrStatsForDay, aggregateDocRetrievedByMonth } from "./xca-dr-stats";
import {
  readOnlyDBPool,
  ImplementerStatsByDay,
  MonthlyImplementerStats,
  aggregateDurationAvgByMonth,
  CQDirectoryEntryData,
  MonthlyAvgByImplementer,
} from "./shared";

/**
 * Script to generate CareQuality monthly stats.
 *
 * The results are stored in the `./runs` directory.
 *
 * You should find results for each day under the `runs/cq-monthly-stats` directory.
 * The aggregated results for the month are stored under `runs/cq-monthly-stats` as:
 * - `xcpd-non-err-resp.csv`
 * - `xca-doc-retrieved.csv`
 * - `durations.csv`
 *
 * To run this script:
 * - `npm run cq-monthly-stats`
 *
 * - Set the `howManyDaysToRun` const.
 * - If you want to run for a specific number of days, set this to the number of days you want to run.
 * - If you want to run for the entire month, set this to undefined or 0.
 */

const howManyDaysToRun = 3;

const baseResultsDir = `./runs/cq-monthly-stats`;
const cqDirectoryPath = `${baseResultsDir}/cq-directory.json`;

async function main() {
  let cqDirectory: CQDirectoryEntryData[] = [];

  if (fs.existsSync(cqDirectoryPath)) {
    console.log("Using stored CQ directory");
    cqDirectory = JSON.parse(fs.readFileSync(cqDirectoryPath, "utf8"));
  } else {
    console.log("Fetching CQ directory from DB");
    const sqlCQDirectory = `SELECT * FROM cq_directory_entry_view`;
    cqDirectory = await readOnlyDBPool.query(sqlCQDirectory, {
      type: QueryTypes.SELECT,
    });

    console.log("cqDirectory length:", typeof cqDirectory, cqDirectory.length);

    const chunks = [];
    for (const entry of cqDirectory) {
      chunks.push(JSON.stringify(entry));
    }
    fs.writeFileSync(cqDirectoryPath, `[${chunks.join(",")}]`);
  }

  console.log("cqDirectory length:", cqDirectory.length);

  const previousMonth = buildDayjs().subtract(1, "month");
  const previousMonthYear = previousMonth.year();
  const daysInPreviousMonth = previousMonth.daysInMonth();
  const endOfPreviousMonth = previousMonth.endOf("month").format(ISO_DATE);

  const daysToRun = howManyDaysToRun || daysInPreviousMonth;

  const xcpdByDate: ImplementerStatsByDay = {};
  const xcaDQByDate: ImplementerStatsByDay = {};
  const xcaDRByDate: ImplementerStatsByDay = {};

  const baseResultsDirDayNow = `${baseResultsDir}/individual-runs/${new Date().toISOString()}`;

  for (let i = 0; i < daysToRun; i++) {
    const day = previousMonth.endOf("month").subtract(i, "day").format(ISO_DATE);
    const baseResultsDirDay = `${baseResultsDir}/${day}`;
    fs.mkdirSync(baseResultsDirDay, { recursive: true });
    fs.mkdirSync(`${baseResultsDirDayNow}/${day}`, { recursive: true });

    console.log("day:", day);

    const params = { cqDirectory, endOfPreviousMonth, dayIndex: i };

    console.log(`${baseResultsDirDay}/xcpd.json`);

    console.log(fs.existsSync(`${baseResultsDirDay}/xcpd.json`));
    if (fs.existsSync(`${baseResultsDirDay}/xcpd.json`)) {
      console.log("Using stored XCPD results");
      xcpdByDate[day] = JSON.parse(fs.readFileSync(`${baseResultsDirDay}/xcpd.json`, "utf8"));
    } else {
      const xcpd = await getXcpdStatsForDay(params);
      xcpdByDate[day] = xcpd;
      fs.writeFileSync(`${baseResultsDirDay}/xcpd.json`, JSON.stringify(xcpd, null, 2));
      fs.writeFileSync(`${baseResultsDirDayNow}/${day}/xcpd.json`, JSON.stringify(xcpd, null, 2));
    }

    if (fs.existsSync(`${baseResultsDirDay}/xca-dq.json`)) {
      console.log("Using stored XCA-DQ results");
      xcaDQByDate[day] = JSON.parse(fs.readFileSync(`${baseResultsDirDay}/xca-dq.json`, "utf8"));
    } else {
      const xcaDQ = await getXcaDqStatsForDay(params);
      xcaDQByDate[day] = xcaDQ;
      fs.writeFileSync(`${baseResultsDirDay}/xca-dq.json`, JSON.stringify(xcaDQ, null, 2));
      fs.writeFileSync(
        `${baseResultsDirDayNow}/${day}/xca-dq.json`,
        JSON.stringify(xcaDQ, null, 2)
      );
    }
    if (fs.existsSync(`${baseResultsDirDay}/xca-dr.json`)) {
      console.log("Using stored XCA-DR results");
      xcaDRByDate[day] = JSON.parse(fs.readFileSync(`${baseResultsDirDay}/xca-dr.json`, "utf8"));
    } else {
      const xcaDR = await getXcaDrStatsForDay(params);
      xcaDRByDate[day] = xcaDR;
      fs.writeFileSync(`${baseResultsDirDay}/xca-dr.json`, JSON.stringify(xcaDR, null, 2));
      fs.writeFileSync(
        `${baseResultsDirDayNow}/${day}/xca-dr.json`,
        JSON.stringify(xcaDR, null, 2)
      );
    }
  }

  const fullMonthMultiplier = howManyDaysToRun ? daysInPreviousMonth / daysToRun : 1;

  const xcpdMonthlyStats = aggregateNonXcpdErrRespByMonth(xcpdByDate, fullMonthMultiplier);
  createXcpdSuccessfulRespCsv(xcpdMonthlyStats);

  const xcaDRMonthlyStats = aggregateDocRetrievedByMonth(xcaDRByDate, fullMonthMultiplier);
  createDocRetrievedCsv(xcaDRMonthlyStats);

  const avgResponseTime = aggregateDurationAvgByMonth(xcpdByDate, xcaDQByDate, xcaDRByDate);
  createAvgCsv(previousMonth.month() + 1, previousMonthYear, avgResponseTime);

  process.exit(0);
}

function createXcpdSuccessfulRespCsv(monthlyStats: MonthlyImplementerStats[]) {
  let csv =
    "Year,Month,Implementer Id,Implementer Name,Number of Non-errored XCPD query responses received\n";

  monthlyStats.forEach(stat => {
    const { year, month, implementerId, implementerName, nonErroredResponses } = stat;
    csv += `${year},${month},${implementerId},${implementerName},${nonErroredResponses}\n`;
  });

  fs.writeFileSync(`${baseResultsDir}/xcpd-successful-resp.csv`, csv);
}

function createDocRetrievedCsv(monthlyStats: MonthlyImplementerStats[]) {
  let csv = "Year,Month,Implementer Id,Implementer Name,Number of Documents Retrieved\n";

  monthlyStats.forEach(stat => {
    const { year, month, implementerId, implementerName, totalDocRetrieved } = stat;
    csv += `${year},${month},${implementerId},${implementerName},${totalDocRetrieved}\n`;
  });

  fs.writeFileSync(`${baseResultsDir}/xca-doc-retrieved.csv`, csv);
}

function createAvgCsv(year: number, month: number, monthlyStats: MonthlyAvgByImplementer) {
  let csv =
    "Year,Month,Implementer Id,Implementer Name,Median XCPD (in ms),Median XCA Query (in ms),Median XCA Retrieve (in ms)\n";

  Object.entries(monthlyStats).forEach(([implementerId, implementerStat]) => {
    const {
      implementerName,
      xcpdAvgResponseTimeMs,
      xcaDQAvgResponseTimeMs,
      xcaDRAvgResponseTimeMs,
    } = implementerStat;
    csv += `${year},${month},${implementerId},${implementerName},${xcpdAvgResponseTimeMs},${xcaDQAvgResponseTimeMs},${xcaDRAvgResponseTimeMs}\n`;
  });

  fs.writeFileSync(`${baseResultsDir}/durations.csv`, csv);
}

main();
