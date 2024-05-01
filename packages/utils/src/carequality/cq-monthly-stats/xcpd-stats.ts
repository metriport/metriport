import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { OutboundPatientDiscoveryResp } from "@metriport/ihe-gateway-sdk";
import dayjs from "dayjs";
import { merge } from "lodash";
import duration from "dayjs/plugin/duration";
import {
  queryResultsTable,
  associateGWToImplementer,
  GWWithStats,
  ImplementerWithGwStats,
  getDurationsPerGW,
  CountPerGW,
  RequestParams,
  ImplementerStatsByDay,
  MonthlyImplementerStats,
} from "./shared";

dayjs.extend(duration);

const patientDiscoveryResultTableName = "patient_discovery_result";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function xcpdStats({
  cqDirectory,
  endOfPreviousMonth,
  dayIndex,
}: RequestParams): Promise<ImplementerWithGwStats[]> {
  const xcpdGWStats: GWWithStats[] = await aggregateXCPDGWStats(endOfPreviousMonth, dayIndex);

  const xcpdStats: ImplementerWithGwStats[] = await associateGWToImplementer(
    xcpdGWStats,
    cqDirectory
  );

  return xcpdStats;
}

async function aggregateXCPDGWStats(
  endOfPreviousMonth: string,
  dayIndex: number
): Promise<GWWithStats[]> {
  const tableResults = await queryResultsTable<OutboundPatientDiscoveryResp>(
    patientDiscoveryResultTableName,
    endOfPreviousMonth,
    dayIndex
  );

  const durationsPerGW: GWWithStats[] = getDurationsPerGW(tableResults);
  const nonErroredResponsesPerGW: GWWithStats[] = getNonErroredResponsesPerGW(tableResults);

  return merge(durationsPerGW, nonErroredResponsesPerGW);
}

function getNonErroredResponsesPerGW(results: OutboundPatientDiscoveryResp[]): GWWithStats[] {
  const nonErroredResponsesPerGW: CountPerGW = {};
  const xcpdGWStats: GWWithStats[] = [];

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

export function aggregateNonXcpdErrRespByMonth(
  statsByDay: ImplementerStatsByDay
): MonthlyImplementerStats[] {
  const monthlyStats: MonthlyImplementerStats[] = [];

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

      if (existingStat && existingStat.nonErroredResponses) {
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

export function aggregateGwNonErroredResponses(gwWithStats: GWWithStats[]): number {
  return gwWithStats.reduce((acc, curr) => {
    const gwStat = curr.nonErroredResponses ?? 0;
    return acc + gwStat;
  }, 0);
}
