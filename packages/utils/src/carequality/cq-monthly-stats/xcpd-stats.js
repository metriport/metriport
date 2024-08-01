const dotenv = require("dotenv");
dotenv.config();
// keep that ^ on top
const { OutboundPatientDiscoveryResp } = require("@metriport/ihe-gateway-sdk");
const dayjs = require("dayjs");
const { merge } = require("lodash");
const duration = require("dayjs/plugin/duration");
const {
  queryResultsTable,
  associateGWToImplementer,
  GWWithStats,
  ImplementerWithGwStats,
  getDurationsPerGW,
  CountPerGW,
  RequestParams,
  ImplementerStatsByDay,
  MonthlyImplementerStats,
} = require("./shared");

dayjs.extend(duration);

const patientDiscoveryResultTableName = "patient_discovery_result";

// eslint-disable-next-line no-undef
async function xcpdStats({ cqDirectory, endOfPreviousMonth, dayIndex }) {
  const xcpdGWStats = await aggregateXCPDGWStats(endOfPreviousMonth, dayIndex);

  const xcpdStats = await associateGWToImplementer(xcpdGWStats, cqDirectory);

  return xcpdStats;
}

async function aggregateXCPDGWStats(endOfPreviousMonth, dayIndex) {
  const tableResults = await queryResultsTable(
    patientDiscoveryResultTableName,
    endOfPreviousMonth,
    dayIndex
  );

  const durationsPerGW = getDurationsPerGW(tableResults);
  const nonErroredResponsesPerGW = getNonErroredResponsesPerGW(tableResults);

  return merge(durationsPerGW, nonErroredResponsesPerGW);
}

function getNonErroredResponsesPerGW(results) {
  const nonErroredResponsesPerGW = {};
  const xcpdGWStats = [];

  results.forEach(result => {
    const gwId = result.gateway.oid;
    const nonErroredResponses = result.patientMatch ? 1 : 0;

    if (!nonErroredResponsesPerGW[gwId]) {
      nonErroredResponsesPerGW[gwId] = [nonErroredResponses];
    }

    nonErroredResponsesPerGW[gwId].push(nonErroredResponses);
  });

  for (const [gwId, nonErroredResponses] of Object.entries(nonErroredResponsesPerGW)) {
    const totalNonErroredResponses = nonErroredResponses.reduce((acc, curr) => acc + curr, 0);

    xcpdGWStats.push({
      gwId,
      nonErroredResponses: totalNonErroredResponses,
    });
  }

  return xcpdGWStats;
}

function aggregateNonXcpdErrRespByMonth(statsByDay) {
  const monthlyStats = [];

  Object.entries(statsByDay).forEach(([day, stats]) => {
    stats.forEach(stat => {
      const { implementerId, implementerName } = stat;
      const { gwStats } = stat;

      const year = dayjs(day).year();
      const month = dayjs(day).month() + 1;

      const existingStat = monthlyStats.find(
        s => s.year === year && s.month === month && s.implementerId === implementerId
      );

      const nonErroredResponses = aggregateGwNonErroredResponses(gwStats);

      if (existingStat && existingStat.nonErroredResponses !== undefined) {
        existingStat.nonErroredResponses += nonErroredResponses;
      } else {
        monthlyStats.push({
          year,
          month,
          implementerId,
          implementerName,
          nonErroredResponses: nonErroredResponses * 30,
        });
      }
    });
  });

  return monthlyStats;
}

function aggregateGwNonErroredResponses(gwWithStats) {
  return gwWithStats.reduce((acc, curr) => {
    const gwStat = curr.nonErroredResponses ?? 0;
    return acc + gwStat;
  }, 0);
}

module.exports = {
  xcpdStats,
  aggregateNonXcpdErrRespByMonth,
  aggregateGwNonErroredResponses,
};
