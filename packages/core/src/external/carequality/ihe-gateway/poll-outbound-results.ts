import {
  OutboundDocumentQueryResp,
  OutboundDocumentRetrievalResp,
  OutboundPatientDiscoveryResp,
} from "@metriport/ihe-gateway-sdk";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { QueryTypes, Sequelize } from "sequelize";
import { MetriportError } from "../../../util/error/metriport-error";
import { errorToString } from "../../../util/error/shared";
import { capture } from "../../../util/notifications";
import { checkIfRaceIsComplete, controlDuration, RaceControl } from "../../../util/race-control";
import { initDBPool } from "../../../util/sequelize";
import {
  OutboundDocumentQueryRespTableEntry,
  OutboundDocumentRetrievalRespTableEntry,
  OutboundPatientDiscoveryRespTableEntry,
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
    context: "Patient Discovery",
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
    context: "Document Query",
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
    context: "Document Retrieval",
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
  context,
}: PollOutboundResults & {
  resultsTable: string;
  context: string;
}): Promise<object[]> {
  const sequelize = initDBPool(dbCreds);
  const raceControl: RaceControl = { isRaceInProgress: true };
  const maxTimeout = maxPollingDuration ?? CONTROL_TIMEOUT.asMilliseconds();

  try {
    // Run the table count until it either times out, or all the results are in the database
    const raceResult = await Promise.race([
      controlDuration(
        maxTimeout,
        `Timed out waiting for IHE GW ${context}, after ${maxTimeout} ms`
      ),
      checkIfRaceIsComplete(
        () => isResultsComplete(sequelize, resultsTable, requestId, numOfGateways),
        raceControl,
        `IHE GW results came back in full (${numOfGateways} links).`,
        CHECK_DB_INTERVAL.asMilliseconds()
      ),
    ]);

    const iheGatewayResults = await getResults(sequelize, resultsTable, requestId);

    const allGWsCompleted = iheGatewayResults.length === numOfGateways;
    const details = `Got ${iheGatewayResults.length} successes out of ${numOfGateways} gateways for ${resultsTable}. RequestID: ${requestId}`;

    if (raceResult && allGWsCompleted) {
      console.log(`${raceResult}. ${details}`);
      raceControl.isRaceInProgress = false;
    } else if (!allGWsCompleted) {
      const msg = `IHE GW results are incomplete for ${context}`;
      console.log(`${msg}. ${details}`);
      capture.message(msg, {
        extra: {
          requestId,
          patientId,
          cxId,
          resultsTable,
          numOfGateways,
          iheGatewayResults,
          context,
        },
        level: "info",
      });
    }
    // TODO Include in the result if it timed out and allGwsCompleted
    return iheGatewayResults;
  } catch (error) {
    const msg = `Failed to query IHE GW results`;
    console.log(`${msg}, ${context} - table: ${resultsTable}. Error: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      requestId,
      patientId,
      cxId,
      numOfGateways,
      context,
      resultsTable,
    });
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
    const msg = `Failed to get result count from table ${resultsTable}`;
    throw new MetriportError(msg, error, { resultsTable, requestId });
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
    throw new MetriportError(msg, error, { resultsTable, requestId });
  }
}
