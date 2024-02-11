import { Sequelize, QueryTypes } from "sequelize";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { RaceControl, checkIfRaceIsComplete, controlDuration } from "../../../../util/race-control";
import { MetriportError } from "../../../../util/error/metriport-error";
import { initSequelizeForLambda } from "../../../../util/sequelize";
import { errorToString } from "../../../../util/error/shared";
import { REQUEST_ID_COLUMN } from "../../ihe-result";

dayjs.extend(duration);

export const CONTROL_TIMEOUT = dayjs.duration({ minutes: 3 });
const CHECK_DB_INTERVAL = dayjs.duration({ seconds: 30 });

export const pollIHEGatewayResults = async <TableResult>({
  requestId,
  patientId,
  cxId,
  numOfGateways,
  dbCreds,
  endpointUrl,
  resultsTable,
}: {
  requestId: string;
  patientId: string;
  cxId: string;
  numOfGateways: number;
  dbCreds: string;
  endpointUrl: string;
  resultsTable: string;
}): Promise<TableResult[]> => {
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
        () => isIheGatewayResultsComplete(sequelize, resultsTable, requestId, numOfGateways),
        raceControl,
        `IHE gateway results came back in full (${numOfGateways} links).`,
        CHECK_DB_INTERVAL.asMilliseconds()
      ),
    ]);

    const iheGatewayResults = await queryIHEGatewayResults<TableResult>(
      sequelize,
      resultsTable,
      requestId
    );

    if (raceResult) {
      console.log(
        `${raceResult}. Got ${iheGatewayResults.length} successes out of ${numOfGateways} gateways for ${resultsTable}. RequestID: ${requestId}`
      );
      raceControl.isRaceInProgress = false;
    }

    return iheGatewayResults;
  } catch (error) {
    const msg = `Failed to post ihe gateway results - table: ${resultsTable}`;
    console.log(`${msg} - endpoint ${endpointUrl}. Error: ${errorToString(error)}`);
    throw new MetriportError(msg, error, { requestId, patientId, cxId, numOfGateways });
  }
};

async function isIheGatewayResultsComplete(
  sequelize: Sequelize,
  resultsTable: string,
  requestId: string,
  numOfGatewaysInRequest: number
): Promise<boolean> {
  const iheResultCount = await getIHEGatewayResultCount(sequelize, resultsTable, requestId);
  return iheResultCount >= numOfGatewaysInRequest;
}

async function getIHEGatewayResultCount(
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
    const msg = `Failed to get ${resultsTable} result count`;

    throw new MetriportError(msg, error);
  }
}

async function queryIHEGatewayResults<TableResult>(
  sequelize: Sequelize,
  resultsTable: string,
  requestId: string
): Promise<TableResult[]> {
  try {
    const query = `SELECT * FROM ${resultsTable} WHERE ${REQUEST_ID_COLUMN} = '${requestId}' ORDER BY created_at DESC;`;
    const res = (await sequelize.query(query, {
      type: QueryTypes.SELECT,
    })) as TableResult[];

    return res;
  } catch (error) {
    const msg = `Failed to query ${resultsTable} results. Error: ${error}`;

    throw new MetriportError(msg, error);
  }
}
