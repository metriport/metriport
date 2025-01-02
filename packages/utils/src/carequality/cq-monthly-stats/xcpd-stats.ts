import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import fs from "fs";
import { merge } from "lodash";
import {
  associateGwToImplementer,
  GWWithStats,
  ImplementerWithGwStats,
  CountPerGW,
  RequestParams,
  ImplementerStatsByDay,
  MonthlyImplementerStats,
  findExistingStatByImplementer,
  getDurationsPerGW as getAthenaDurationsPerGw,
} from "./shared";
import { queryResultsTableAthena, TableResults } from "./athena-shared";
import { buildDayjs, ISO_DATE } from "@metriport/shared/common/date";

export async function getXcpdStatsForDay({
  cqDirectory,
  endOfPreviousMonth,
  dayIndex,
}: RequestParams): Promise<ImplementerWithGwStats[]> {
  const xcpdGWStats: GWWithStats[] = await aggregateXcpdGwStats(endOfPreviousMonth, dayIndex);

  const xcpdStats: ImplementerWithGwStats[] = await associateGwToImplementer(
    xcpdGWStats,
    cqDirectory
  );

  fs.writeFileSync(
    `./non-errored-responses-per-gw-${buildDayjs().format(ISO_DATE)}-implementer.json`,
    JSON.stringify(xcpdStats, null, 2)
  );

  return xcpdStats;
}

async function aggregateXcpdGwStats(
  endOfPreviousMonth: string,
  dayIndex: number
): Promise<GWWithStats[]> {
  const tableResults = await queryResultsTableAthena(endOfPreviousMonth, dayIndex);

  const durationsPerGW: GWWithStats[] = getAthenaDurationsPerGw(tableResults);
  const nonErroredResponsesPerGW: GWWithStats[] = getNonErroredResponsesPerGW(tableResults);

  return merge(durationsPerGW, nonErroredResponsesPerGW);
}

function getNonErroredResponsesPerGW(results: TableResults[]): GWWithStats[] {
  const nonErroredResponsesPerGW: CountPerGW = {};
  const xcpdGWStats: GWWithStats[] = [];

  results.forEach(result => {
    const oidMatch = result.gateway.match(/oid=([^,]+)/);
    const gwId = oidMatch && oidMatch[1] ? oidMatch[1].trim() : undefined;
    const nonErroredResponses = result.patientmatch ? 1 : 0;

    if (gwId) {
      if (!nonErroredResponsesPerGW[gwId]) {
        nonErroredResponsesPerGW[gwId] = [nonErroredResponses];
      }

      nonErroredResponsesPerGW[gwId].push(nonErroredResponses);
    }
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
  statsByDay: ImplementerStatsByDay,
  fullMonthMultiplier = 1
): MonthlyImplementerStats[] {
  const monthlyStats: MonthlyImplementerStats[] = [];

  Object.entries(statsByDay).forEach(([day, stats]) => {
    stats.forEach(stat => {
      const { implementerId, implementerName, gwStats } = stat;

      const year = buildDayjs(day).year();
      const month = buildDayjs(day).month() + 1;

      const existingStat = findExistingStatByImplementer(implementerId, monthlyStats);

      const nonErroredResponses = aggregateGwNonErroredResponses(gwStats);

      if (existingStat && existingStat.nonErroredResponses !== undefined) {
        existingStat.nonErroredResponses += nonErroredResponses;
      } else {
        monthlyStats.push({
          year,
          month,
          implementerId,
          implementerName,
          nonErroredResponses: nonErroredResponses * fullMonthMultiplier,
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
