import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { OutboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import {
  GWWithStats,
  ImplementerWithGwStats,
  associateGWToImplementer,
  queryResultsTable,
  getDurationsPerGW,
  RequestParams,
} from "./shared";

dayjs.extend(duration);

const documentQueryResultTableName = "document_query_result";

export async function xcaDQStats({
  cqDirectory,
  endOfPreviousMonth,
  dayIndex,
}: RequestParams): Promise<ImplementerWithGwStats[]> {
  const xcaDQGWStats: GWWithStats[] = await aggregateXcaDQGWStats(endOfPreviousMonth, dayIndex);

  const xcaDQStats: ImplementerWithGwStats[] = await associateGWToImplementer(
    xcaDQGWStats,
    cqDirectory
  );

  return xcaDQStats;
}

async function aggregateXcaDQGWStats(
  endOfPreviousMonth: string,
  dayIndex: number
): Promise<GWWithStats[]> {
  const tableResults = await queryResultsTable<OutboundDocumentQueryResp>(
    documentQueryResultTableName,
    endOfPreviousMonth,
    dayIndex
  );

  const durationsPerGW: GWWithStats[] = getDurationsPerGW(tableResults);

  return durationsPerGW;
}
