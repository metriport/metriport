import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { initReadonlyDbPool } from "@metriport/core/util/sequelize";
import { QueryTypes } from "sequelize";
import { mean } from "lodash";

const sqlDBCreds = getEnvVarOrFail("DB_CREDS");
const sqlReadReplicaEndpoint = getEnvVarOrFail("DB_READ_REPLICA_ENDPOINT");

export const readOnlyDBPool = initReadonlyDbPool(sqlDBCreds, sqlReadReplicaEndpoint);

export type RequestParams = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cqDirectory: any[];
  endOfPreviousMonth: string;
  dayIndex: number;
};

export type GWStats = {
  nonErroredResponses?: number;
  totalDocRetrieved?: number;
  avgResponseTimeMs?: number;
};

export type GWWithStats = {
  gwId: string;
} & GWStats;

export type Implementer = {
  implementerId: string;
  implementerName: string;
};

export type ImplementerWithAvgResp = Implementer & {
  avgResponseTimeMs: number;
};

export type ImplementerWithGwStats = Implementer & {
  gwStats: GWWithStats[];
};

export type ImplementerStats = Implementer & GWStats;

export type ImplementerStatsByDay = {
  [day: string]: ImplementerWithGwStats[];
};

export type DurationAvgs = {
  xcpdAvgResponseTimeMs?: number;
  xcaDQAvgResponseTimeMs?: number;
  xcaDRAvgResponseTimeMs?: number;
};

export type MonthlyImplementerStats = {
  year: number;
  month: number;
} & ImplementerStats &
  DurationAvgs;

export type CountPerGW = { [key: string]: [number] };

export async function queryResultsTable<TableResults>(
  tableName: string,
  endOfPreviousMonth: string,
  dayIndex: number
): Promise<TableResults[]> {
  const dayPlusOne = dayIndex + 1;

  console.log(`Querying table ${tableName} for day ${dayPlusOne}...`);

  const query = `
      SELECT * FROM ${tableName}
      WHERE created_at > date '${endOfPreviousMonth}' - INTERVAL '${dayPlusOne} days'
      AND created_at < date '${endOfPreviousMonth}' - INTERVAL '${dayPlusOne - 1} days'
    `;

  const results = await readOnlyDBPool.query(query, {
    type: QueryTypes.SELECT,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resultsData = results.map((result: any) => result.data) as TableResults[];

  console.log(`Results for table ${tableName} day ${dayPlusOne}:`, results.length);

  return resultsData;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDurationsPerGW(results: any[]): GWWithStats[] {
  const durationsPerGW: CountPerGW = {};
  const gwStats: GWWithStats[] = [];

  results.forEach(result => {
    const gwId = result.gateway.oid || result.gateway.homeCommunityId;
    const duration = result.duration;

    if (duration) {
      if (!durationsPerGW[gwId]) {
        durationsPerGW[gwId] = [duration];
      }

      durationsPerGW[gwId].push(duration);
    }
  });

  for (const [gwId, durations] of Object.entries(durationsPerGW)) {
    const totalDuration = durations.reduce((acc, curr) => acc + curr, 0);
    const avgDuration = totalDuration / durations.length;

    gwStats.push({
      gwId,
      avgResponseTimeMs: avgDuration,
    });
  }

  return gwStats;
}

export function associateGWToImplementer(
  xcpdGWStats: GWWithStats[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cqDirectory: any[]
): ImplementerWithGwStats[] {
  const implementerStats: ImplementerWithGwStats[] = [];

  for (const gwStats of xcpdGWStats) {
    const implementer = findGWImplementer(gwStats.gwId, gwStats, cqDirectory);

    if (!implementer) {
      console.log(`Could not find implementer for gateway ${gwStats.gwId}`);
      continue;
    }

    const implementerStatsEntry = implementerStats.find(
      entry => entry.implementerId === implementer.oid
    );

    if (implementerStatsEntry) {
      implementerStatsEntry.gwStats.push(gwStats);
    } else {
      implementerStats.push({
        implementerId: implementer.oid,
        implementerName: implementer.name,
        gwStats: [gwStats],
      });
    }
  }

  return implementerStats;
}

function findGWImplementer(
  gateway: string,
  stats: GWStats,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cqDirectory: any[]
): { name: string; oid: string } | undefined {
  const cqDirectoryGW = cqDirectory.find(entry => entry.id === gateway);

  if (cqDirectoryGW) {
    const managingOrganizationId = cqDirectoryGW.managing_organization_id;
    const isItself = managingOrganizationId === cqDirectoryGW.id;

    if (!managingOrganizationId) {
      return { name: cqDirectoryGW.name, oid: cqDirectoryGW.id };
    } else if (isItself && managingOrganizationId) {
      return { name: cqDirectoryGW.name, oid: cqDirectoryGW.id };
    }

    return findGWImplementer(managingOrganizationId, stats, cqDirectory);
  }

  return undefined;
}

export function aggregateDurationAvgByMonth(
  year: number,
  month: number,
  xcpdStatsByDay: ImplementerStatsByDay,
  xcaDQStatsByDay: ImplementerStatsByDay,
  xcaDRStatsByDay: ImplementerStatsByDay
): MonthlyImplementerStats[] {
  const monthlyStats: MonthlyImplementerStats[] = [];

  const xcpdDailyAvgsByImplementer = getMonthlyAvgByImplementer(xcpdStatsByDay);
  const xcaDQDailyAvgsByImplementer = getMonthlyAvgByImplementer(xcaDQStatsByDay);
  const xcaDRDailyAvgsByImplementer = getMonthlyAvgByImplementer(xcaDRStatsByDay);

  xcpdDailyAvgsByImplementer.forEach(implementerStat => {
    const { implementerId, implementerName, avgResponseTimeMs } = implementerStat;

    const existingStat = monthlyStats.find(
      s => s.year === year && s.month === month && s.implementerId === implementerId
    );

    if (existingStat) {
      existingStat.xcpdAvgResponseTimeMs = avgResponseTimeMs;
    } else {
      monthlyStats.push({
        year,
        month,
        implementerId,
        implementerName,
        xcpdAvgResponseTimeMs: avgResponseTimeMs,
      });
    }
  });

  xcaDQDailyAvgsByImplementer.forEach(implementerStat => {
    const { implementerId, implementerName, avgResponseTimeMs } = implementerStat;

    const existingStat = monthlyStats.find(
      s => s.year === year && s.month === month && s.implementerId === implementerId
    );

    if (existingStat) {
      existingStat.xcaDQAvgResponseTimeMs = avgResponseTimeMs;
    } else {
      monthlyStats.push({
        year,
        month,
        implementerId,
        implementerName,
        xcaDQAvgResponseTimeMs: avgResponseTimeMs,
      });
    }
  });

  xcaDRDailyAvgsByImplementer.forEach(implementerStat => {
    const { implementerId, implementerName, avgResponseTimeMs } = implementerStat;

    const existingStat = monthlyStats.find(
      s => s.year === year && s.month === month && s.implementerId === implementerId
    );

    if (existingStat) {
      existingStat.xcaDRAvgResponseTimeMs = avgResponseTimeMs;
    } else {
      monthlyStats.push({
        year,
        month,
        implementerId,
        implementerName,
        xcaDRAvgResponseTimeMs: avgResponseTimeMs,
      });
    }
  });

  return monthlyStats;
}

function getMonthlyAvgByImplementer(statsByDay: ImplementerStatsByDay): ImplementerWithAvgResp[] {
  const monthlyAvgsByImplementer: {
    [key: string]: {
      implementerId: string;
      implementerName: string;
      avgResponseTimeMs: number[];
    };
  } = {};

  Object.values(statsByDay).forEach(stats => {
    stats.forEach(stat => {
      const { implementerId, implementerName } = stat;
      const { gwStats } = stat;

      const avgResponseTimeMs = aggregateGwAvgResponseTime(gwStats);

      monthlyAvgsByImplementer[implementerId] = {
        implementerId,
        implementerName,
        avgResponseTimeMs: [
          ...(monthlyAvgsByImplementer[implementerId]
            ? monthlyAvgsByImplementer[implementerId].avgResponseTimeMs
            : [avgResponseTimeMs]),
          avgResponseTimeMs,
        ],
      };
    });
  });

  return Object.values(monthlyAvgsByImplementer).map(value => {
    return {
      implementerId: value.implementerId,
      implementerName: value.implementerName,
      avgResponseTimeMs: mean(value.avgResponseTimeMs),
    };
  });
}

export function aggregateGwAvgResponseTime(gwWithStats: GWWithStats[]): number {
  const totalAvgResponseTime = gwWithStats.reduce((acc, curr) => {
    const gwStat = curr.avgResponseTimeMs ?? 0;
    return acc + gwStat;
  }, 0);

  return totalAvgResponseTime / gwWithStats.length;
}
