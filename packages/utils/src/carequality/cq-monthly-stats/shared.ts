import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { initReadonlyDbPool } from "@metriport/core/util/sequelize";
import { QueryTypes } from "sequelize";

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
  nonErroredResponses?: string;
  totalDocRetrieved?: string;
  avgResponseTimeMs?: number;
};

export type GWWithStats = {
  [gw: string]: GWStats;
};

export type ImplementerStats = {
  implementer?: string;
  gw?: string;
  avgResponseTimeMs?: number;
  nonErroredResponses?: string;
  totalDocRetrieved?: string;
};

export type CountPerGW = { [key: string]: [number] };

export async function queryResultsTable<TableResults>(
  tableName: string,
  endOfPreviousMonth: string,
  dayIndex: number
): Promise<TableResults[]> {
  const dayPlusOne = dayIndex + 1;

  console.log(`Querying for day ${dayPlusOne}...`);

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

  console.log(`Results for day ${dayPlusOne}:`, results.length);

  return resultsData;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDurationsPerGW(results: any[]): GWWithStats {
  const durationsPerGW: CountPerGW = {};
  const xcpdGWStats: GWWithStats = {};

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

    xcpdGWStats[gwId] = {
      avgResponseTimeMs: avgDuration,
    };
  }

  return xcpdGWStats;
}

export function associateGWToImplementer(
  gwStats: GWWithStats,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cqDirectory: any[]
): ImplementerStats[] {
  const implementerStats: ImplementerStats[] = [];

  for (const [gateway, stats] of Object.entries(gwStats)) {
    const implementer = findGWImplementer(gateway, stats, cqDirectory);

    if (!implementer) {
      console.log(`Could not find implementer for gateway ${gateway}`);
      continue;
    }

    implementerStats.push({ implementer, gw: gateway, ...stats });
  }

  return implementerStats;
}

function findGWImplementer(
  gateway: string,
  stats: GWStats,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cqDirectory: any[]
): string | undefined {
  const cqDirectoryGW = cqDirectory.find(entry => entry.id === gateway);

  if (cqDirectoryGW) {
    const managingOrganizationId = cqDirectoryGW.managing_organization_id;
    const isItself = managingOrganizationId === cqDirectoryGW.id;

    if (!managingOrganizationId) {
      return cqDirectoryGW.name;
    } else if (isItself && managingOrganizationId) {
      return cqDirectoryGW.name;
    }

    return findGWImplementer(managingOrganizationId, stats, cqDirectory);
  }

  return undefined;
}
