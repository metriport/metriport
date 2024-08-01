const dotenv = require("dotenv");
dotenv.config();
// keep that ^ on top
const { OutboundDocumentQueryResp } = require("@metriport/ihe-gateway-sdk");
const dayjs = require("dayjs");
const duration = require("dayjs/plugin/duration");
const {
  GWWithStats,
  ImplementerWithGwStats,
  associateGWToImplementer,
  queryResultsTable,
  getDurationsPerGW,
  RequestParams,
} = require("./shared");

dayjs.extend(duration);

const documentQueryResultTableName = "document_query_result";

async function xcaDQStats({ cqDirectory, endOfPreviousMonth, dayIndex }) {
  const xcaDQGWStats = await aggregateXcaDQGWStats(endOfPreviousMonth, dayIndex);

  const xcaDQStats = await associateGWToImplementer(xcaDQGWStats, cqDirectory);

  return xcaDQStats;
}

async function aggregateXcaDQGWStats(endOfPreviousMonth, dayIndex) {
  const tableResults = await queryResultsTable(
    documentQueryResultTableName,
    endOfPreviousMonth,
    dayIndex
  );

  const durationsPerGW = getDurationsPerGW(tableResults);

  return durationsPerGW;
}

module.exports = {
  xcaDQStats,
  aggregateXcaDQGWStats,
};
