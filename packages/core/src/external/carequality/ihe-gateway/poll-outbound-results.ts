import {
  OutboundPatientDiscoveryResp,
  OutboundDocumentQueryResp,
  OutboundDocumentRetrievalResp,
} from "@metriport/ihe-gateway-sdk";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { QueryTypes, Sequelize } from "sequelize";
import { MetriportError } from "../../../util/error/metriport-error";
import { errorToString } from "../../../util/error/shared";
import { capture } from "../../../util/notifications";
import { checkIfRaceIsComplete, controlDuration, RaceControl } from "../../../util/race-control";
import { initSequelizeForLambda } from "../../../util/sequelize";
import {
  OutboundPatientDiscoveryRespTableEntry,
  OutboundDocumentQueryRespTableEntry,
  OutboundDocumentRetrievalRespTableEntry,
} from "./outbound-result";

dayjs.extend(duration);

const CONTROL_TIMEOUT = dayjs.duration({ minutes: 15 });
const CHECK_DB_INTERVAL = dayjs.duration({ seconds: 10 });

const REQUEST_ID_COLUMN = "request_id";
const PATIENT_DISCOVERY_RESULT_TABLE_NAME = "patient_discovery_result";
const DOC_QUERY_RESULT_TABLE_NAME = "document_query_result";
const DOC_RETRIEVAL_RESULT_TABLE_NAME = "document_retrieval_result";

type PollOutboundResults = {
  requestId: string;
  patientId: string;
  cxId: string;
  numOfGateways: number;
  dbCreds: string;
  maxPollingDuration?: number;
};

export async function pollOutboundPatientDiscoveryResults(
  params: PollOutboundResults
): Promise<OutboundPatientDiscoveryResp[]> {
  const results = await pollResults({
    ...params,
    resultsTable: PATIENT_DISCOVERY_RESULT_TABLE_NAME,
  });
  // Since we're not using Sequelize models, we need to cast the results to the correct type
  return (results as OutboundPatientDiscoveryRespTableEntry[]).map(r => r.data);
}

export async function pollOutboundDocQueryResults(
  params: PollOutboundResults
): Promise<OutboundDocumentQueryResp[]> {
  const results = await pollResults({
    ...params,
    resultsTable: DOC_QUERY_RESULT_TABLE_NAME,
  });
  // Since we're not using Sequelize models, we need to cast the results to the correct type
  return (results as OutboundDocumentQueryRespTableEntry[]).map(r => r.data);
}

export async function pollOutboundDocRetrievalResults(
  params: PollOutboundResults
): Promise<OutboundDocumentRetrievalResp[]> {
  const results = await pollResults({
    ...params,
    resultsTable: DOC_RETRIEVAL_RESULT_TABLE_NAME,
  });
  // Since we're not using Sequelize models, we need to cast the results to the correct type
  return (results as OutboundDocumentRetrievalRespTableEntry[]).map(r => r.data);
}

async function pollResults({
  requestId,
  patientId,
  cxId,
  numOfGateways,
  maxPollingDuration,
  dbCreds,
  resultsTable,
}: PollOutboundResults & {
  resultsTable: string;
}): Promise<object[]> {
  const sequelize = initSequelizeForLambda(dbCreds);

  const raceControl: RaceControl = { isRaceInProgress: true };

  try {
    // Run the table count until it either times out, or all the results are in the database
    const raceResult = await Promise.race([
      controlDuration(
        maxPollingDuration ?? CONTROL_TIMEOUT.asMilliseconds(),
        `IHE gateway reached timeout after ${
          maxPollingDuration ?? CONTROL_TIMEOUT.asMilliseconds()
        } ms`
      ),
      checkIfRaceIsComplete(
        () => isResultsComplete(sequelize, resultsTable, requestId, numOfGateways),
        raceControl,
        `IHE gateway results came back in full (${numOfGateways} links).`,
        CHECK_DB_INTERVAL.asMilliseconds()
      ),
    ]);

    const iheGatewayResults = await getResults(sequelize, resultsTable, requestId);

    const allGWsCompleted = iheGatewayResults.length === numOfGateways;

    if (raceResult && allGWsCompleted) {
      console.log(
        `${raceResult}. Got ${iheGatewayResults.length} responses out of ${numOfGateways} gateways for ${resultsTable}. RequestID: ${requestId}`
      );
      raceControl.isRaceInProgress = false;
    } else if (!allGWsCompleted) {
      const msg = `IHE gateway results are incomplete.`;
      console.log(
        `${msg}. Got ${iheGatewayResults.length} responses out of ${numOfGateways} gateways for ${resultsTable}. RequestID: ${requestId}`
      );

      capture.message(msg, {
        extra: {
          requestId,
          patientId,
          cxId,
          resultsTable,
          numOfGateways,
          iheGatewayResults,
        },
      });
    }

    return iheGatewayResults;
  } catch (error) {
    const msg = `Failed to post ihe gateway results - table: ${resultsTable}`;
    console.log(`${msg}. Error: ${errorToString(error)}`);
    throw new MetriportError(msg, error, { requestId, patientId, cxId, numOfGateways });
  }
}

async function isResultsComplete(
  sequelize: Sequelize,
  resultsTable: string,
  requestId: string,
  numOfGatewaysInRequest: number
): Promise<boolean> {
  const iheResultCount = await getResultsCount(sequelize, resultsTable, requestId);
  return iheResultCount >= numOfGatewaysInRequest;
}

async function getResultsCount(
  sequelize: Sequelize,
  resultsTable: string,
  requestId: string
): Promise<number> {
  try {
    const query = `SELECT COUNT(*) FROM ${resultsTable} WHERE ${REQUEST_ID_COLUMN} = '${requestId}';`;

    const [res] = await sequelize.query<{ count: number }>(query, {
      type: QueryTypes.SELECT,
    });

    return res?.count || 0;
  } catch (error) {
    const msg = `Failed to get result count`;

    throw new MetriportError(msg, error, { resultsTable });
  }
}

async function getResults(
  sequelize: Sequelize,
  resultsTable: string,
  requestId: string
): Promise<object[]> {
  try {
    const query = `SELECT * FROM ${resultsTable} WHERE ${REQUEST_ID_COLUMN} = '${requestId}' ORDER BY created_at DESC;`;
    const results = await sequelize.query(query, {
      type: QueryTypes.SELECT,
    });

    return results;
  } catch (error) {
    const msg = `Failed to query table ${resultsTable}`;
    throw new MetriportError(msg, error);
  }
}
