import { Sequelize, QueryTypes } from "sequelize";
import axios from "axios";
import { sleep } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { capture } from "../../util/notifications";
import { MetriportError } from "../../util/error/metriport-error";

const api = axios.create();

dayjs.extend(duration);

export const DOC_QUERY_TIMEOUT = dayjs.duration({ minutes: 3 });
const CHECK_DB_INTERVAL = dayjs.duration({ seconds: 5 });

type RaceControl = { isRaceInProgress: boolean };

type DocumentQueryResult = {
  requestId: string;
  status: string;
  createdAt: Date;
  data: {
    documentReference: {
      homeCommunityId: string;
      docUniqueId: string;
      repositoryUniqueId: string;
      contentType?: string | null;
      language?: string | null;
      uri?: string | null;
      creation?: string | null;
      title?: string | null;
    }[];
    gateway: { homeCommunityId: string; url: string };
  };
};

export const getDocumentQueryResults = async ({
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

  try {
    await api.post(endpointUrl, {
      requestId,
      patientId,
      cxId,
      documentQueryResults,
    });
  } catch (error) {
    const msg = `Failed to post document query results to ${endpointUrl}. Error: ${error}`;
    console.log(`${msg}: ${error}`);
    throw new MetriportError(msg, error, { requestId, numOfLinks });
  }
};

function initSequelize(dbCreds: string) {
  const sqlDBCreds = JSON.parse(dbCreds);

  const sequelize = new Sequelize(sqlDBCreds.dbname, sqlDBCreds.username, sqlDBCreds.password, {
    host: sqlDBCreds.host,
    port: sqlDBCreds.port,
    dialect: sqlDBCreds.engine,
    pool: {
      max: 50,
      min: 20,
      acquire: 30000,
      idle: 10000,
    },
  });
  return sequelize;
}

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
): Promise<string | undefined> {
  while (raceControl.isRaceInProgress) {
    const isComplete = await isDQComplete(sequelize, requestId, numOfLinks);
    if (isComplete) {
      const msg = `Document Query results came back in full (${numOfLinks} links). RequestID: ${requestId}`;
      raceControl.isRaceInProgress = false;
      return msg;
    }
    await sleep(CHECK_DB_INTERVAL.asMilliseconds());
  }

  return;
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
    const query = `SELECT COUNT(*) FROM document_query_result WHERE request_id = '${requestId}';`;

    const [res] = await sequelize.query<{ count: number }>(query, {
      type: QueryTypes.SELECT,
    });

    return res?.count || 0;
  } catch (error) {
    const msg = `Failed to get document query result count. Error: ${error}`;
    capture.message(msg, {
      extra: {
        context: `cq.getDocumentQueryResultCount`,
        error,
        requestId,
      },
      level: "error",
    });
    throw new Error(msg);
  }
}

async function queryDocumentQueryResults(
  sequelize: Sequelize,
  requestId: string
): Promise<DocumentQueryResult[]> {
  try {
    const query = `SELECT * FROM document_query_result WHERE request_id = '${requestId}' ORDER BY created_at DESC;`;
    const res = await sequelize.query<DocumentQueryResult>(query, {
      type: QueryTypes.SELECT,
    });

    return res || [];
  } catch (error) {
    const msg = `Failed to query document query results. Error: ${error}`;
    capture.message(msg, {
      extra: {
        context: `cq.queryDocumentQueryResults`,
        error,
        requestId,
      },
      level: "error",
    });
    throw new Error(msg);
  }
}
