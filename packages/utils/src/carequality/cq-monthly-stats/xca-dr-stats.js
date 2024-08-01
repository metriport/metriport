const dotenv = require("dotenv");
dotenv.config();
// keep that ^ on top
const { OutboundDocumentRetrievalResp } = require("@metriport/ihe-gateway-sdk");
const dayjs = require("dayjs");
const { merge } = require("lodash");
const duration = require("dayjs/plugin/duration");
const {
  ImplementerWithGwStats,
  GWWithStats,
  queryResultsTable,
  getDurationsPerGW,
  associateGWToImplementer,
  RequestParams,
  CountPerGW,
  ImplementerStatsByDay,
  MonthlyImplementerStats,
} = require("./shared");

dayjs.extend(duration);

const documentRetrievalResultTableName = "document_retrieval_result";

async function xcaDRStats({ cqDirectory, endOfPreviousMonth, dayIndex }) {
  const xcaDRGWStats = await aggregateXcaDRGWStats(endOfPreviousMonth, dayIndex);

  const xcaDRStats = await associateGWToImplementer(xcaDRGWStats, cqDirectory);

  return xcaDRStats;
}

async function aggregateXcaDRGWStats(endOfPreviousMonth, dayIndex) {
  const tableResults = await queryResultsTable(
    documentRetrievalResultTableName,
    endOfPreviousMonth,
    dayIndex
  );

  const durationsPerGW = getDurationsPerGW(tableResults);
  const totalDocRetrievedPerGW = getTotalDocRetrievedPerGW(tableResults);

  return merge(durationsPerGW, totalDocRetrievedPerGW);
}

function getTotalDocRetrievedPerGW(results) {
  const totalDocRetrievedPerGW = {};
  const xcaDQGWStats = [];

  results.forEach(result => {
    const gwId = result.gateway.homeCommunityId;
    const totalDocRetrieved = result.documentReference ? result.documentReference.length : 0;

    if (!totalDocRetrievedPerGW[gwId]) {
      totalDocRetrievedPerGW[gwId] = [totalDocRetrieved];
    } else {
      totalDocRetrievedPerGW[gwId].push(totalDocRetrieved);
    }
  });

  for (const [gwId, totalDocRetrieved] of Object.entries(totalDocRetrievedPerGW)) {
    const totalDocs = totalDocRetrieved.reduce((acc, curr) => acc + curr, 0);

    xcaDQGWStats.push({
      gwId,
      totalDocRetrieved: totalDocs,
    });
  }

  return xcaDQGWStats;
}

function aggregateDocRetrievedByMonth(statsByDay) {
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

      const totalDocRetrieved = aggregateGwTotalDocReceived(gwStats);

      if (existingStat) {
        existingStat.totalDocRetrieved += totalDocRetrieved;
      } else {
        monthlyStats.push({
          year,
          month,
          implementerId,
          implementerName,
          totalDocRetrieved: totalDocRetrieved * 30,
        });
      }
    });
  });

  return monthlyStats;
}

function aggregateGwTotalDocReceived(gwWithStats) {
  return gwWithStats.reduce((acc, curr) => {
    const gwStat = curr.totalDocRetrieved || 0;
    return acc + gwStat;
  }, 0);
}

module.exports = {
  xcaDRStats,
  aggregateXcaDRGWStats,
  getTotalDocRetrievedPerGW,
  aggregateDocRetrievedByMonth,
  aggregateGwTotalDocReceived,
};
