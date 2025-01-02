import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { OutboundDocumentRetrievalResp } from "@metriport/ihe-gateway-sdk";
import dayjs from "dayjs";
import { merge } from "lodash";
import duration from "dayjs/plugin/duration";
import {
  ImplementerWithGwStats,
  GWWithStats,
  queryResultsTable,
  getDurationsPerGW,
  associateGwToImplementer,
  RequestParams,
  CountPerGW,
  ImplementerStatsByDay,
  MonthlyImplementerStats,
  findExistingStatByImplementer,
  QUERY_RESULTS_TABLE_NAMES,
} from "./shared";

dayjs.extend(duration);

export async function getXcaDrStatsForDay({
  cqDirectory,
  endOfPreviousMonth,
  dayIndex,
}: RequestParams): Promise<ImplementerWithGwStats[]> {
  const xcaDRGWStats: GWWithStats[] = await aggregateXcaDRGWStats(endOfPreviousMonth, dayIndex);

  const xcaDRStats: ImplementerWithGwStats[] = await associateGwToImplementer(
    xcaDRGWStats,
    cqDirectory
  );

  return xcaDRStats;
}

async function aggregateXcaDRGWStats(
  endOfPreviousMonth: string,
  dayIndex: number
): Promise<GWWithStats[]> {
  const tableResults = await queryResultsTable<OutboundDocumentRetrievalResp>(
    QUERY_RESULTS_TABLE_NAMES.documentRetrieval,
    endOfPreviousMonth,
    dayIndex
  );

  const durationsPerGW: GWWithStats[] = getDurationsPerGW(tableResults);
  const totalDocRetrievedPerGW: GWWithStats[] = getTotalDocRetrievedPerGW(tableResults);

  return merge(durationsPerGW, totalDocRetrievedPerGW);
}

function getTotalDocRetrievedPerGW(results: OutboundDocumentRetrievalResp[]): GWWithStats[] {
  const totalDocRetrievedPerGW: CountPerGW = {};
  const xcaDQGWStats: GWWithStats[] = [];

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

    xcaDQGWStats.push({
      gwId,
      totalDocRetrieved: totalDocs,
    });
  }

  return xcaDQGWStats;
}

export function aggregateDocRetrievedByMonth(
  statsByDay: ImplementerStatsByDay,
  fullMonthMultiplier = 1
): MonthlyImplementerStats[] {
  const monthlyStats: MonthlyImplementerStats[] = [];

  Object.entries(statsByDay).forEach(([day, stats]) => {
    stats.forEach(stat => {
      const { implementerId, implementerName, gwStats } = stat;

      const year = dayjs(day).year();
      const month = dayjs(day).month() + 1;

      const existingStat = findExistingStatByImplementer(implementerId, monthlyStats);

      const totalDocRetrieved = aggregateGwTotalDocReceived(gwStats);

      if (existingStat && existingStat.totalDocRetrieved) {
        existingStat.totalDocRetrieved += totalDocRetrieved;
      } else {
        monthlyStats.push({
          year,
          month,
          implementerId,
          implementerName,
          totalDocRetrieved: totalDocRetrieved * fullMonthMultiplier,
        });
      }
    });
  });

  return monthlyStats;
}

export function aggregateGwTotalDocReceived(gwWithStats: GWWithStats[]): number {
  return gwWithStats.reduce((acc, curr) => {
    const gwStat = curr.totalDocRetrieved ?? 0;
    return acc + gwStat;
  }, 0);
}
