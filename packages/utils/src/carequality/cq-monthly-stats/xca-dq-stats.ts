import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { OutboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk";
import dayjs from "dayjs";
import { merge } from "lodash";
import duration from "dayjs/plugin/duration";
import {
  GWWithStats,
  ImplementerStats,
  associateGWToImplementer,
  queryResultsTable,
  getDurationsPerGW,
  CountPerGW,
  RequestParams,
} from "./shared";

dayjs.extend(duration);

const documentQueryResultTableName = "document_query_result";

export async function xcaDQStats({
  cqDirectory,
  endOfPreviousMonth,
  dayIndex,
}: RequestParams): Promise<ImplementerStats[]> {
  const xcaDQGWStats: GWWithStats = await aggregateXcaDQGWStats(endOfPreviousMonth, dayIndex);

  const xcaDQStats: ImplementerStats[] = await associateGWToImplementer(xcaDQGWStats, cqDirectory);

  return xcaDQStats;
}

async function aggregateXcaDQGWStats(
  endOfPreviousMonth: string,
  dayIndex: number
): Promise<GWWithStats> {
  const tableResults = await queryResultsTable<OutboundDocumentQueryResp>(
    documentQueryResultTableName,
    endOfPreviousMonth,
    dayIndex
  );

  const durationsPerGW: GWWithStats = getDurationsPerGW(tableResults);
  const totalDocRetrievedPerGW: GWWithStats = getTotalDocRetrievedPerGW(tableResults);

  return merge(durationsPerGW, totalDocRetrievedPerGW);
}

function getTotalDocRetrievedPerGW(results: OutboundDocumentQueryResp[]): GWWithStats {
  const totalDocRetrievedPerGW: CountPerGW = {};
  const xcaDQGWStats: GWWithStats = {};

  results.forEach(result => {
    const gwId = result.gateway.homeCommunityId;
    const totalDocRetrieved = result.documentReference?.length ?? 0;

    if (!totalDocRetrievedPerGW[gwId]) {
      totalDocRetrievedPerGW[gwId] = [totalDocRetrieved];
    }

    totalDocRetrievedPerGW[gwId].push(totalDocRetrieved);
  });

  for (const [gwId, totalDocRetrieved] of Object.entries(totalDocRetrievedPerGW)) {
    const totalDocs = totalDocRetrieved.reduce((acc, curr) => acc + curr, 0);

    xcaDQGWStats[gwId] = {
      totalDocRetrieved: `${totalDocs * 30}`,
    };
  }

  return xcaDQGWStats;
}
