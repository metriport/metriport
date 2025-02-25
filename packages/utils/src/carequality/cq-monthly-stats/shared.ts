import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { initReadonlyDbPool } from "@metriport/core/util/sequelize";
import { Organization } from "@metriport/carequality-sdk/models/organization";
import {
  OutboundDocumentQueryResp,
  OutboundDocumentRetrievalResp,
} from "@metriport/ihe-gateway-sdk";
import { TableResults } from "./athena-shared";
import { QueryTypes } from "sequelize";
import { mean } from "lodash";

const sqlDBCreds = getEnvVarOrFail("DB_CREDS");
const sqlReadReplicaEndpoint = getEnvVarOrFail("DB_READ_REPLICA_ENDPOINT");

export const readOnlyDBPool = initReadonlyDbPool(sqlDBCreds, sqlReadReplicaEndpoint);

export type CQDirectoryEntryData = {
  id: string;
  name?: string;
  url_xcpd?: string;
  url_dq?: string;
  url_dr?: string;
  lat?: number;
  lon?: number;
  state?: string;
  data?: Organization;
  point?: string;
  root_organization?: string;
  managing_organization_id?: string;
  gateway: boolean;
  active: boolean;
  last_updated_at_cq: string;
};

export type RequestParams = {
  cqDirectory: CQDirectoryEntryData[];
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

export type DurationKey =
  | "xcpdAvgResponseTimeMs"
  | "xcaDQAvgResponseTimeMs"
  | "xcaDRAvgResponseTimeMs";

export type DurationAvgsArray = {
  [key in DurationKey]?: number[];
};

export type DurationAvgs = {
  [key in DurationKey]?: number;
};

export type MonthlyImplementerStats = {
  year: number;
  month: number;
} & ImplementerStats &
  DurationAvgsArray;

export type CountPerGW = { [key: string]: [number] };

export type DailyAvgsByImplementer = {
  [implementerId: string]: {
    implementerId: string;
    implementerName: string;
  } & DurationAvgsArray;
};

export type MonthlyAvgByImplementer = {
  [implementerId: string]: {
    implementerId: string;
    implementerName: string;
  } & DurationAvgs;
};

export type QueryResultsTableNames = "document_query_result" | "document_retrieval_result";

export const QUERY_RESULTS_TABLE_NAMES = {
  documentQuery: "document_query_result",
  documentRetrieval: "document_retrieval_result",
} as const;

export async function queryResultsTable<TableResults>(
  tableName: QueryResultsTableNames,
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
export function getDurationsPerGW(
  results: OutboundDocumentQueryResp[] | OutboundDocumentRetrievalResp[] | TableResults[]
): GWWithStats[] {
  const durationsPerGW: CountPerGW = {};
  const gwStats: GWWithStats[] = [];

  results.forEach(result => {
    const gwId = getGwId(result);
    const duration = result.duration;

    if (duration && gwId) {
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

export function getGwId(
  result: OutboundDocumentQueryResp | OutboundDocumentRetrievalResp | TableResults
): string | undefined {
  if (typeof result.gateway === "string") {
    const oidMatch = result.gateway.match(/oid=([^,]+)/);
    const gwId = oidMatch && oidMatch[1] ? oidMatch[1].trim() : undefined;
    return gwId;
  }

  if (result.gateway.homeCommunityId) {
    return result.gateway.homeCommunityId;
  }

  return undefined;
}

export function associateGwToImplementer(
  xcpdGWStats: GWWithStats[],
  cqDirectory: CQDirectoryEntryData[]
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
  cqDirectory: CQDirectoryEntryData[]
): { name: string; oid: string } | undefined {
  const cqDirectoryGW = cqDirectory.find(entry => entry.id === gateway);

  if (!cqDirectoryGW) {
    console.log(`Could not find gateway ${gateway} in CQ directory`);
  }

  if (cqDirectoryGW) {
    const managingOrganizationId = cqDirectoryGW.managing_organization_id;
    const name = cqDirectoryGW.name ?? "";
    const isItself = managingOrganizationId === cqDirectoryGW.id;

    if (!managingOrganizationId) {
      return { name, oid: cqDirectoryGW.id };
    } else if (isItself && managingOrganizationId) {
      return { name, oid: cqDirectoryGW.id };
    }

    return findGWImplementer(managingOrganizationId, stats, cqDirectory);
  }

  return undefined;
}

export function aggregateDurationAvgByMonth(
  xcpdStatsByDay: ImplementerStatsByDay,
  xcaDQStatsByDay: ImplementerStatsByDay,
  xcaDRStatsByDay: ImplementerStatsByDay
): MonthlyAvgByImplementer {
  const monthlyStats: MonthlyAvgByImplementer = {};

  const xcpdDailyAvgsByImplementer = getDailyAvgByImplementer(
    xcpdStatsByDay,
    "xcpdAvgResponseTimeMs"
  );
  const xcaDQDailyAvgsByImplementer = getDailyAvgByImplementer(
    xcaDQStatsByDay,
    "xcaDQAvgResponseTimeMs"
  );
  const xcaDRDailyAvgsByImplementer = getDailyAvgByImplementer(
    xcaDRStatsByDay,
    "xcaDRAvgResponseTimeMs"
  );

  Object.entries(xcpdDailyAvgsByImplementer).forEach(([implementerId, implementerStat]) => {
    const { implementerName, xcpdAvgResponseTimeMs } = implementerStat;

    monthlyStats[implementerId] = {
      ...monthlyStats[implementerId],
      implementerId,
      implementerName,
      xcpdAvgResponseTimeMs: mean(xcpdAvgResponseTimeMs),
    };
  });

  Object.entries(xcaDQDailyAvgsByImplementer).forEach(([implementerId, implementerStat]) => {
    const { implementerName, xcaDQAvgResponseTimeMs } = implementerStat;

    monthlyStats[implementerId] = {
      ...monthlyStats[implementerId],
      implementerId,
      implementerName,
      xcaDQAvgResponseTimeMs: mean(xcaDQAvgResponseTimeMs),
    };
  });

  Object.entries(xcaDRDailyAvgsByImplementer).forEach(([implementerId, implementerStat]) => {
    const { implementerName, xcaDRAvgResponseTimeMs } = implementerStat;

    monthlyStats[implementerId] = {
      ...monthlyStats[implementerId],
      implementerId,
      implementerName,
      xcaDRAvgResponseTimeMs: mean(xcaDRAvgResponseTimeMs),
    };
  });

  return monthlyStats;
}

function getDailyAvgByImplementer(
  statsByDay: ImplementerStatsByDay,
  durationType: DurationKey
): DailyAvgsByImplementer {
  const dailyAvgsByImplementer: DailyAvgsByImplementer = {};

  Object.values(statsByDay).forEach(stats => {
    stats.forEach(stat => {
      const { implementerId, implementerName, gwStats } = stat;
      const avgResponseTimeMs = aggregateGwAvgResponseTime(gwStats);

      if (!dailyAvgsByImplementer[implementerId]) {
        dailyAvgsByImplementer[implementerId] = {
          implementerId,
          implementerName,
          [durationType]: [],
        };
      }

      dailyAvgsByImplementer[implementerId][durationType]?.push(avgResponseTimeMs);
    });
  });

  return dailyAvgsByImplementer;
}

export function aggregateGwAvgResponseTime(gwWithStats: GWWithStats[]): number {
  const totalAvgResponseTime = gwWithStats.reduce((acc, curr) => {
    const gwStat = curr.avgResponseTimeMs ?? 0;
    return acc + gwStat;
  }, 0);

  return totalAvgResponseTime / gwWithStats.length;
}

export function findExistingStatByImplementer(
  implementerId: string,
  monthlyImplementerStats: MonthlyImplementerStats[]
): MonthlyImplementerStats | undefined {
  return monthlyImplementerStats.find(stat => stat.implementerId === implementerId);
}
