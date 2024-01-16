import { Sequelize, QueryTypes } from "sequelize";
import axios from "axios";
import { sleep } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { MetriportError } from "../../../../util/error/metriport-error";
import { initSequelizeForLambda } from "../../../../util/sequelize";
import { errorToString } from "../../../../util/error";

const REQUEST_ID_COLUMN = "request_id";

const api = axios.create();

dayjs.extend(duration);

export const CONTROL_TIMEOUT = dayjs.duration({ minutes: 3 });
const CHECK_DB_INTERVAL = dayjs.duration({ seconds: 5 });

type RaceControl = { isRaceInProgress: boolean };

export const sendIHEGatewayResults = async <TableResult>({
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
}): Promise<void> => {
  const sequelize = initSequelizeForLambda(dbCreds);

  const raceControl: RaceControl = { isRaceInProgress: true };

  try {
    // Run the table count until it either times out, or all the results are in the database
    const raceResult = await Promise.race([
      controlDuration(),
      checkNumberOfResults(sequelize, raceControl, resultsTable, requestId, numOfGateways),
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

    await api.post(endpointUrl, {
      requestId,
      patientId,
      cxId,
      iheGatewayResults,
    });
  } catch (error) {
    const msg = `Failed to post ihe gateway results - table: ${resultsTable}`;
    console.log(`${msg} - endpoint ${endpointUrl}. Error: ${errorToString(error)}`);
    throw new MetriportError(msg, error, { requestId, patientId, cxId, numOfGateways });
  }
};

async function controlDuration(): Promise<string> {
  const timeout = CONTROL_TIMEOUT.asMilliseconds();
  await sleep(timeout);
  return `IHE gateway reached timeout after ${timeout} ms`;
}

async function checkNumberOfResults(
  sequelize: Sequelize,
  raceControl: RaceControl,
  resultsTable: string,
  requestId: string,
  numOfGateways: number
): Promise<string> {
  while (raceControl.isRaceInProgress) {
    const isComplete = await isIheGatewayResultsComplete(
      sequelize,
      resultsTable,
      requestId,
      numOfGateways
    );
    if (isComplete) {
      const msg = `IHE gateway results came back in full (${numOfGateways} links).`;

      return msg;
    }
    await sleep(CHECK_DB_INTERVAL.asMilliseconds());
  }

  return "";
}

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

    throw new MetriportError(msg);
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

    throw new MetriportError(msg);
  }
}
