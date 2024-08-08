const dotenv = require("dotenv");
dotenv.config();
// keep that ^ on top
const { getEnvVarOrFail } = require("@metriport/core/util/env-var");
const { initReadonlyDbPool } = require("@metriport/core/util/sequelize");
const { QueryTypes } = require("sequelize");
const { mean } = require("lodash");

const sqlDBCreds = getEnvVarOrFail("DB_CREDS");
const sqlReadReplicaEndpoint = getEnvVarOrFail("DB_READ_REPLICA_ENDPOINT");

const readOnlyDBPool = initReadonlyDbPool(sqlDBCreds, sqlReadReplicaEndpoint);

async function queryResultsTable(tableName, endOfPreviousMonth, dayIndex) {
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

  // Map to extract data from results
  const resultsData = results.map(result => result.data);

  console.log(`Results for table ${tableName} day ${dayPlusOne}:`, results.length);

  return resultsData;
}

function getDurationsPerGW(results) {
  const durationsPerGW = {};
  const gwStats = [];

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

function associateGWToImplementer(xcpdGWStats, cqDirectory) {
  const implementerStats = [];

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

function findGWImplementer(gateway, stats, cqDirectory) {
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

function aggregateDurationAvgByMonth(
  year,
  month,
  xcpdStatsByDay,
  xcaDQStatsByDay,
  xcaDRStatsByDay
) {
  const monthlyStats = [];

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

function getMonthlyAvgByImplementer(statsByDay) {
  const monthlyAvgsByImplementer = {};

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

function aggregateGwAvgResponseTime(gwWithStats) {
  const totalAvgResponseTime = gwWithStats.reduce((acc, curr) => {
    const gwStat = curr.avgResponseTimeMs ?? 0;
    return acc + gwStat;
  }, 0);

  return totalAvgResponseTime / gwWithStats.length;
}

module.exports = {
  queryResultsTable,
  getDurationsPerGW,
  associateGWToImplementer,
  findGWImplementer,
  aggregateDurationAvgByMonth,
  getMonthlyAvgByImplementer,
  aggregateGwAvgResponseTime,
  readOnlyDBPool,
};
