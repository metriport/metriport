import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { OutboundDocumentRetrievalResp } from "@metriport/ihe-gateway-sdk";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import {
  ImplementerStats,
  GWWithStats,
  queryResultsTable,
  getDurationsPerGW,
  associateGWToImplementer,
  RequestParams,
} from "./shared";

dayjs.extend(duration);

const documentRetrievalResultTableName = "document_retrieval_result";

export async function xcaDRStats({
  cqDirectory,
  endOfPreviousMonth,
  dayIndex,
}: RequestParams): Promise<ImplementerStats> {
  const xcaDRGWStats: GWWithStats = await aggregateXcaDRGWStats(endOfPreviousMonth, dayIndex);

  const xcaDRStats: ImplementerStats = await associateGWToImplementer(xcaDRGWStats, cqDirectory);

  return xcaDRStats;
}

async function aggregateXcaDRGWStats(
  endOfPreviousMonth: string,
  dayIndex: number
): Promise<GWWithStats> {
  const tableResults = await queryResultsTable<OutboundDocumentRetrievalResp>(
    documentRetrievalResultTableName,
    endOfPreviousMonth,
    dayIndex
  );

  const durationsPerGW: GWWithStats = getDurationsPerGW(tableResults);

  return durationsPerGW;
}
