const dotenv = require("dotenv");
dotenv.config();
// keep that ^ on top
const { QueryTypes } = require("sequelize");
const dayjs = require("dayjs");
const duration = require("dayjs/plugin/duration");
const fs = require("fs");
const { sleep } = require("@metriport/shared");
const { xcpdStats, aggregateNonXcpdErrRespByMonth } = require("./xcpd-stats");
const { xcaDQStats } = require("./xca-dq-stats");
const { xcaDRStats, aggregateDocRetrievedByMonth } = require("./xca-dr-stats");
const { readOnlyDBPool, aggregateDurationAvgByMonth } = require("./shared");

dayjs.extend(duration);

// USE STORED RESULTS ON SUBSEQUENT RUNS TO AVOID REPEATEDLY RUNNING THE SAME EXPENSIVE QUERIES

const v8 = require("v8");
const totalHeapSize = v8.getHeapStatistics().total_available_size;
const totalHeapSizeinGB = (totalHeapSize / 1024 / 1024 / 1024).toFixed(2);
console.log(`Total heap size: ${totalHeapSizeinGB} GB`);

async function main() {
  let cqDirectory = [];

  if (fs.existsSync("./runs/cq-directory.json")) {
    console.log("Using stored CQ directory");
    cqDirectory = JSON.parse(fs.readFileSync("./runs/cq-directory.json", "utf8"));
  } else {
    const sqlCQDirectory = "SELECT * FROM cq_directory_entry";
    cqDirectory = await readOnlyDBPool.query(sqlCQDirectory, {
      type: QueryTypes.SELECT,
    });

    fs.writeFileSync("./runs/cq-directory.json", JSON.stringify(cqDirectory, null, 2));
  }

  console.log("cqDirectory:", cqDirectory.length);

  const previousMonth = dayjs().subtract(2, "month");
  const previousMonthYear = previousMonth.year();
  const daysInPreviousMonth = previousMonth.daysInMonth();
  const endOfPreviousMonth = previousMonth.endOf("month").format("YYYY-MM-DD");

  const xcpdByDate = {};
  const xcaDQByDate = {};
  const xcaDRByDate = {};

  for (let i = 0; i < 3; i++) {
    const day = previousMonth.endOf("month").subtract(i, "day").format("YYYY-MM-DD");
    const baseDir = "./runs";
    const baseDirDay = `${baseDir}/${day}`;
    fs.mkdirSync(baseDirDay, { recursive: true });

    console.log("day:", day);

    const params = { cqDirectory, endOfPreviousMonth, dayIndex: i };

    console.log(`${baseDirDay}/xcpd.json`);
    if (fs.existsSync(`${baseDirDay}/xcpd.json`)) {
      console.log("Using stored XCPD results");
      xcpdByDate[day] = JSON.parse(fs.readFileSync(`${baseDirDay}/xcpd.json`, "utf8"));
    } else {
      const xcpd = await xcpdStats(params);
      xcpdByDate[day] = xcpd;
      fs.writeFileSync(`${baseDirDay}/xcpd.json`, JSON.stringify(xcpd, null, 2));
      await sleep(20000);
    }

    if (fs.existsSync(`${baseDirDay}/xca-dq.json`)) {
      console.log("Using stored XCA-DQ results");
      xcaDQByDate[day] = JSON.parse(fs.readFileSync(`${baseDirDay}/xca-dq.json`, "utf8"));
    } else {
      const xcaDQ = await xcaDQStats(params);
      xcaDQByDate[day] = xcaDQ;
      fs.writeFileSync(`${baseDirDay}/xca-dq.json`, JSON.stringify(xcaDQ, null, 2));
      await sleep(20000);
    }

    if (fs.existsSync(`${baseDirDay}/xca-dr.json`)) {
      console.log("Using stored XCA-DR results");
      xcaDRByDate[day] = JSON.parse(fs.readFileSync(`${baseDirDay}/xca-dr.json`, "utf8"));
    } else {
      const xcaDR = await xcaDRStats(params);
      xcaDRByDate[day] = xcaDR;
      fs.writeFileSync(`${baseDirDay}/xca-dr.json`, JSON.stringify(xcaDR, null, 2));
      await sleep(20000);
    }
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

function createXcpdNonErrRespCsv(monthlyStats) {
  let csv =
    "Year,Month,Implementer Id,Implementer Name,Number of Non-errored XCPD query responses received\n";

  monthlyStats.forEach(stat => {
    const { year, month, implementerId, implementerName, nonErroredResponses } = stat;
    csv += `${year},${month},${implementerId},${implementerName},${nonErroredResponses}\n`;
  });

  fs.writeFileSync("./runs/xcpd-non-err-resp.csv", csv);
}

function createDocRetrievedCsv(monthlyStats) {
  let csv = "Year,Month,Implementer Id,Implementer Name,Number of Documents Retrieved\n";

  monthlyStats.forEach(stat => {
    const { year, month, implementerId, implementerName, totalDocRetrieved } = stat;
    csv += `${year},${month},${implementerId},${implementerName},${totalDocRetrieved}\n`;
  });

  fs.writeFileSync("./runs/xca-doc-retrieved.csv", csv);
}

function createAvgCsv(monthlyStats) {
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
