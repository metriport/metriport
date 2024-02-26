import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { QueryTypes, Sequelize } from "sequelize";
import { MetriportError } from "../../../../util/error/metriport-error";
import { errorToString } from "../../../../util/error/shared";
import { capture } from "../../../../util/notifications";
import { checkIfRaceIsComplete, controlDuration, RaceControl } from "../../../../util/race-control";
import { initSequelizeForLambda } from "../../../../util/sequelize";
import {
  DOC_QUERY_RESULT_TABLE_NAME,
  DOC_RETRIEVAL_RESULT_TABLE_NAME,
  OutboundDocumentQueryResp,
  OutboundDocumentRetrievalResp,
  REQUEST_ID_COLUMN,
} from "../../ihe-result";

dayjs.extend(duration);

// TODO 1350 rename/move this file to external/ihe-gateway/poll-outbound-results.ts

const CONTROL_TIMEOUT = dayjs.duration({ minutes: 15 });
const CHECK_DB_INTERVAL = dayjs.duration({ seconds: 30 });

export type PollOutboundResults = {
  requestId: string;
  patientId: string;
  cxId: string;
  numOfGateways: number;
  dbCreds: string;
  endpointUrl: string;
};

export async function pollOutboundDQResults(
  params: PollOutboundResults
): Promise<OutboundDocumentQueryResp[]> {
  const results = await pollResults({
    ...params,
    resultsTable: DOC_QUERY_RESULT_TABLE_NAME,
  });
  // Since we're not using Sequelize models, we need to cast the results to the correct type
  return results as OutboundDocumentQueryResp[];
}

export async function pollOutboundDRResults(
  params: PollOutboundResults
): Promise<OutboundDocumentQueryResp[]> {
  const results = await pollResults({
    ...params,
    resultsTable: DOC_RETRIEVAL_RESULT_TABLE_NAME,
  });
  // Since we're not using Sequelize models, we need to cast the results to the correct type
  return results as OutboundDocumentRetrievalResp[];
}

async function pollResults({
  requestId,
  patientId,
  cxId,
  numOfGateways,
  dbCreds,
  endpointUrl,
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
        CONTROL_TIMEOUT.asMilliseconds(),
        `IHE gateway reached timeout after ${CONTROL_TIMEOUT.asMilliseconds()} ms`
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
        `${raceResult}. Got ${iheGatewayResults.length} successes out of ${numOfGateways} gateways for ${resultsTable}. RequestID: ${requestId}`
      );
      raceControl.isRaceInProgress = false;
    } else if (!allGWsCompleted) {
      const msg = `IHE gateway results are incomplete.`;
      console.log(
        `${msg}. Got ${iheGatewayResults.length} successes out of ${numOfGateways} gateways for ${resultsTable}. RequestID: ${requestId}`
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
    console.log(`${msg} - endpoint ${endpointUrl}. Error: ${errorToString(error)}`);
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
