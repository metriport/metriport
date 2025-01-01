import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import dayjs from "dayjs";
import fs from "fs";
import { merge } from "lodash";
import duration from "dayjs/plugin/duration";
import {
  associateGwToImplementer,
  GWWithStats,
  ImplementerWithGwStats,
  CountPerGW,
  RequestParams,
  ImplementerStatsByDay,
  MonthlyImplementerStats,
} from "./shared";
import {
  queryResultsTableAthena,
  getDurationsPerGW as getAthenaDurationsPerGw,
  TableResults,
} from "./athena-shared";

dayjs.extend(duration);

const patientDiscoveryResultTableName = "patient_discovery_result";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function xcpdStats({
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
    `./non-errored-responses-per-gw-${dayjs().format("YYYY-MM-DD")}-impplementer.json`,
    JSON.stringify(xcpdStats, null, 2)
  );

  return xcpdStats;
}

async function aggregateXcpdGwStats(
  endOfPreviousMonth: string,
  dayIndex: number
): Promise<GWWithStats[]> {
  const tableResults = await queryResultsTableAthena(
    patientDiscoveryResultTableName,
    endOfPreviousMonth,
    dayIndex
  );

  const durationsPerGW: GWWithStats[] = getAthenaDurationsPerGw(tableResults);
  const nonErroredResponsesPerGW: GWWithStats[] = getNonErroredResponsesPerGW(tableResults);

  return merge(durationsPerGW, nonErroredResponsesPerGW);
}

function getNonErroredResponsesPerGW(results: TableResults[]): GWWithStats[] {
  const nonErroredResponsesPerGW: CountPerGW = {};
  const xcpdGWStats: GWWithStats[] = [];

  results.forEach(result => {
    const oidMatch = result.gateway.match(/oid=([^,]+)/);
    const gwId = oidMatch ? oidMatch[1].trim() : "";
    const nonErroredResponses = result.patientmatch ? 1 : 0;

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
  statsByDay: ImplementerStatsByDay,
  fullMonthMultiplier = 1
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
