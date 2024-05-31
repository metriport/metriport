import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { QueryTypes } from "sequelize";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { sleep } from "@metriport/shared";
import { xcpdStats, aggregateNonXcpdErrRespByMonth } from "./xcpd-stats";
import { xcaDQStats } from "./xca-dq-stats";
import { xcaDRStats, aggregateDocRetrievedByMonth } from "./xca-dr-stats";
import {
  readOnlyDBPool,
  ImplementerStatsByDay,
  MonthlyImplementerStats,
  aggregateDurationAvgByMonth,
} from "./shared";

dayjs.extend(duration);

// USE STORED RESULTS ON SUBSEQUENT RUNS TO AVOID REPEATEDLY RUNNING THE SAME EXPENSIVE QUERIES

async function main() {
  const sqlCQDirectory = `SELECT * FROM cq_directory_entry`;
  const cqDirectory = await readOnlyDBPool.query(sqlCQDirectory, {
    type: QueryTypes.SELECT,
  });

  console.log("cqDirectory:", cqDirectory.length);

  const previousMonth = dayjs().subtract(1, "month");
  const previousMonthYear = previousMonth.year();
  const daysInPreviousMonth = previousMonth.daysInMonth();
  const endOfPreviousMonth = previousMonth.endOf("month").format("YYYY-MM-DD");

  const xcpdByDate: ImplementerStatsByDay = {};
  const xcaDQByDate: ImplementerStatsByDay = {};
  const xcaDRByDate: ImplementerStatsByDay = {};

  for (let i = 0; i < daysInPreviousMonth; i++) {
    const day = previousMonth.subtract(i, "day").format("YYYY-MM-DD");
    const baseDir = `./runs`;
    const baseDirDay = `${baseDir}/${day}`;
    fs.mkdirSync(baseDirDay, { recursive: true });

    console.log("day:", day);

    const params = { cqDirectory, endOfPreviousMonth, dayIndex: i };

    const xcpd = await xcpdStats(params);
    const xcaDQ = await xcaDQStats(params);
    const xcaDR = await xcaDRStats(params);

    xcpdByDate[day] = xcpd;
    xcaDQByDate[day] = xcaDQ;
    xcaDRByDate[day] = xcaDR;

    fs.writeFileSync(`${baseDirDay}/xcpd.json`, JSON.stringify(xcpd, null, 2));
    fs.writeFileSync(`${baseDirDay}/xca-dq.json`, JSON.stringify(xcaDQ, null, 2));
    fs.writeFileSync(`${baseDirDay}/xca-dr.json`, JSON.stringify(xcaDR, null, 2));

    await sleep(60000);
  }

  const xcpdMonthlyStats = aggregateNonXcpdErrRespByMonth(xcpdByDate);
  createXcpdNonErrRespCsv(xcpdMonthlyStats);

  const xcaDRMonthlyStats = aggregateDocRetrievedByMonth(xcaDRByDate);
  createDocRetrievedCsv(xcaDRMonthlyStats);

  const xcpdAvgResponseTime = aggregateDurationAvgByMonth(
    previousMonth.month() + 1,
    previousMonthYear,
    xcpdByDate,
    xcaDQByDate,
    xcaDRByDate
  );
  createAvgCsv(xcpdAvgResponseTime);

  process.exit(0);
}

function createXcpdNonErrRespCsv(monthlyStats: MonthlyImplementerStats[]) {
  let csv =
    "Year,Month,Implementer Id,Implementer Name,Number of Non-errored XCPD query responses received\n";

  monthlyStats.forEach(stat => {
    const { year, month, implementerId, implementerName, nonErroredResponses } = stat;
    csv += `${year},${month},${implementerId},${implementerName},${nonErroredResponses}\n`;
  });

  fs.writeFileSync("./runs/xcpd-non-err-resp.csv", csv);
}

function createDocRetrievedCsv(monthlyStats: MonthlyImplementerStats[]) {
  let csv = "Year,Month,Implementer Id,Implementer Name,Number of Documents Retrieved\n";

  monthlyStats.forEach(stat => {
    const { year, month, implementerId, implementerName, totalDocRetrieved } = stat;
    csv += `${year},${month},${implementerId},${implementerName},${totalDocRetrieved}\n`;
  });

  fs.writeFileSync("./runs/xca-doc-retrieved.csv", csv);
}

function createAvgCsv(monthlyStats: MonthlyImplementerStats[]) {
  let csv =
    "Year,Month,Implementer Id,Implementer Name,Median XCPD (in ms),Median XCA Query (in ms),Median XCA Retrieve (in ms)\n";

  monthlyStats.forEach(stat => {
    const {
      year,
      month,
      implementerId,
      implementerName,
      xcpdAvgResponseTimeMs,
      xcaDQAvgResponseTimeMs,
      xcaDRAvgResponseTimeMs,
    } = stat;
    csv += `${year},${month},${implementerId},${implementerName},${xcpdAvgResponseTimeMs},${xcaDQAvgResponseTimeMs},${xcaDRAvgResponseTimeMs}\n`;
  });

  fs.writeFileSync("./runs/durations.csv", csv);
}

main();
