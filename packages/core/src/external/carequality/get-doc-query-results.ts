import { Sequelize, QueryTypes } from "sequelize";
import axios from "axios";
import { sleep } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { MetriportError } from "../../util/error/metriport-error";
import { initSequelize } from "../../util/sequelize";
import { errorToString } from "../../util/error";
import { DocumentQueryResult, TABLE_NAME, REQUEST_ID_COLUMN } from "./domain/document-query-result";

const api = axios.create();

dayjs.extend(duration);

export const DOC_QUERY_TIMEOUT = dayjs.duration({ minutes: 3 });
const CHECK_DB_INTERVAL = dayjs.duration({ seconds: 5 });

type RaceControl = { isRaceInProgress: boolean };

export const sendDocumentQueryResults = async ({
  requestId,
  patientId,
  cxId,
  numOfLinks,
  dbCreds,
  endpointUrl,
}: {
  requestId: string;
  patientId: string;
  cxId: string;
  numOfLinks: number;
  dbCreds: string;
  endpointUrl: string;
}): Promise<void> => {
  const sequelize = initSequelize(dbCreds);

  const raceControl: RaceControl = { isRaceInProgress: true };

  try {
    // Run the document query until it either times out, or all the results are in the database
    const raceResult = await Promise.race([
      controlDuration(),
      checkNumberOfResults(sequelize, raceControl, requestId, numOfLinks),
    ]);

    const documentQueryResults = await queryDocumentQueryResults(sequelize, requestId);

    if (raceResult) {
      console.log(
        `${raceResult}. Got ${documentQueryResults.length} successes out of ${numOfLinks} gateways for PD. RequestID: ${requestId}`
      );
      raceControl.isRaceInProgress = false;
    }

    await api.post(endpointUrl, {
      requestId,
      patientId,
      cxId,
      documentQueryResults,
    });
  } catch (error) {
    const msg = `Failed to post document query results`;
    console.log(`${msg} - endpoint ${endpointUrl}. Error: ${errorToString(error)}`);
    throw new MetriportError(msg, error, { requestId, patientId, cxId, numOfLinks });
  }
};

async function controlDuration(): Promise<string> {
  const timeout = DOC_QUERY_TIMEOUT.asMilliseconds();
  await sleep(timeout);
  return `Document Query reached timeout after ${timeout} ms`;
}

async function checkNumberOfResults(
  sequelize: Sequelize,
  raceControl: RaceControl,
  requestId: string,
  numOfLinks: number
): Promise<string> {
  while (raceControl.isRaceInProgress) {
    const isComplete = await isDQComplete(sequelize, requestId, numOfLinks);
    if (isComplete) {
      const msg = `Document Query results came back in full (${numOfLinks} links).`;

      return msg;
    }
    await sleep(CHECK_DB_INTERVAL.asMilliseconds());
  }

  return "";
}

async function isDQComplete(
  sequelize: Sequelize,
  requestId: string,
  numOfLinksInRequest: number
): Promise<boolean> {
  const dqResultCount = await getDocumentQueryResultCount(sequelize, requestId);
  return dqResultCount >= numOfLinksInRequest;
}

async function getDocumentQueryResultCount(
  sequelize: Sequelize,
  requestId: string
): Promise<number> {
  try {
    const query = `SELECT COUNT(*) FROM ${TABLE_NAME} WHERE ${REQUEST_ID_COLUMN} = '${requestId}';`;

    const [res] = await sequelize.query<{ count: number }>(query, {
      type: QueryTypes.SELECT,
    });

    return res?.count || 0;
  } catch (error) {
    const msg = `Failed to get document query result count`;

    throw new MetriportError(msg);
  }
}

async function queryDocumentQueryResults(
  sequelize: Sequelize,
  requestId: string
): Promise<DocumentQueryResult[]> {
  try {
    const query = `SELECT * FROM ${TABLE_NAME} WHERE ${REQUEST_ID_COLUMN} = '${requestId}' ORDER BY created_at DESC;`;
    const res = (await sequelize.query<DocumentQueryResult>(query, {
      type: QueryTypes.SELECT,
    })) as DocumentQueryResult[];

    return res;
  } catch (error) {
    const msg = `Failed to query document query results. Error: ${error}`;

    throw new MetriportError(msg);
  }
}
