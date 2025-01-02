import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { OutboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk";
import {
  GWWithStats,
  ImplementerWithGwStats,
  associateGwToImplementer,
  queryResultsTable,
  getDurationsPerGW,
  RequestParams,
  QUERY_RESULTS_TABLE_NAMES,
} from "./shared";

export async function getXcaDqStatsForDay({
  cqDirectory,
  endOfPreviousMonth,
  dayIndex,
}: RequestParams): Promise<ImplementerWithGwStats[]> {
  const xcaDQGWStats: GWWithStats[] = await aggregateXcaDqGwStats(endOfPreviousMonth, dayIndex);

  const xcaDqStats: ImplementerWithGwStats[] = associateGwToImplementer(xcaDQGWStats, cqDirectory);

  return xcaDqStats;
}

async function aggregateXcaDqGwStats(
  endOfPreviousMonth: string,
  dayIndex: number
): Promise<GWWithStats[]> {
  const tableResults = await queryResultsTable<OutboundDocumentQueryResp>(
    QUERY_RESULTS_TABLE_NAMES.documentQuery,
    endOfPreviousMonth,
    dayIndex
  );

  const durationsPerGW: GWWithStats[] = getDurationsPerGW(tableResults);

  return durationsPerGW;
}
