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
  ImplementerStats,
  getDurationsPerGW,
  CountPerGW,
  RequestParams,
} from "./shared";

dayjs.extend(duration);

const patientDiscoveryResultTableName = "patient_discovery_result";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function xcpdStats({
  cqDirectory,
  endOfPreviousMonth,
  dayIndex,
}: RequestParams): Promise<ImplementerStats> {
  const xcpdGWStats: GWWithStats = await aggregateXCPDGWStats(endOfPreviousMonth, dayIndex);

  const xcpdStats: ImplementerStats = await associateGWToImplementer(xcpdGWStats, cqDirectory);

  return xcpdStats;
}

async function aggregateXCPDGWStats(
  endOfPreviousMonth: string,
  dayIndex: number
): Promise<GWWithStats> {
  const tableResults = await queryResultsTable<OutboundPatientDiscoveryResp>(
    patientDiscoveryResultTableName,
    endOfPreviousMonth,
    dayIndex
  );

  const durationsPerGW: GWWithStats = getDurationsPerGW(tableResults);
  const nonErroredResponsesPerGW: GWWithStats = getNonErroredResponsesPerGW(tableResults);

  return merge(durationsPerGW, nonErroredResponsesPerGW);
}

function getNonErroredResponsesPerGW(results: OutboundPatientDiscoveryResp[]): GWWithStats {
  const nonErroredResponsesPerGW: CountPerGW = {};
  const xcpdGWStats: GWWithStats = {};

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

    xcpdGWStats[gwId] = {
      ...xcpdGWStats[gwId],
      nonErroredResponses: `${totalNonErroredResponses} / ${nonErroredResponses.length}`,
    };
  }

  return xcpdGWStats;
}
