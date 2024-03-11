import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { QueryTypes } from "sequelize";
import { executeAsynchronously } from "../../concurrency";
import { initSequelizeForLambda } from "../../sequelize";
import {
  QueryReplacements,
  countContentTypes,
  getYesterdaysTimeFrame,
  mapToString,
  mergeMaps,
} from "../shared";

const MAX_NUMBER_OF_PARALLEL_DQ_PROCESSING_REQUESTS = 20;

/**
 * Returns statistics for DQ, including the following:
 * 1) # of DQs
 * 2) # of success responses
 * 3) # of document references
 * 4) content types and their counts
 *
 * @param sqlDBCreds    The SQL database credentials.
 * @param cxId          The CX ID.
 * @param patientId     Optional, the patient ID. If not provided, the statistics will be calculated for all patients of the customer organization.
 * @param dateString    Optional, The date string. If not provided, the statistics will be calculated for the 24 hr period starting at 25 hr ago.
 */
export async function getDqStatistics(
  sqlDBCreds: string,
  cxId: string,
  patientId?: string,
  dateString?: string
): Promise<string> {
  console.log("Starting DQ statistics calculation...");
  const sequelize = initSequelizeForLambda(sqlDBCreds, false);

  let query = `
  SELECT * FROM document_query_result 
  WHERE data->>'cxId'=:cxId
  `;

  const replacements: QueryReplacements = {
    cxId,
  };

  if (dateString) {
    query += ` and created_at>:dateString`;
    replacements.dateString = dateString;
  } else {
    const [yesterday, today] = getYesterdaysTimeFrame();
    query += ` and created_at between :yesterday and :today`;
    if (today && yesterday) {
      replacements.yesterday = yesterday;
      replacements.today = today;
    }
  }

  if (patientId) {
    query += ` and patient_id=:patientId`;
    replacements.patientId = patientId;
  }

  query += ";";

  try {
    const dqResults = await sequelize.query(query, {
      replacements: replacements,
      type: QueryTypes.SELECT,
    });

    const numberOfRows = dqResults.length;

    const stats: { contentTypes: Map<string, number>; numberOfDocRefs: number }[] = [];
    let numberOfSuccesses = 0;
    let numberOfDocuments = 0;
    const totalContentTypes = new Map<string, number>();

    // TODO: need to define the type of `dq`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processDqResult = async (dq: any) => {
      const docRefs = dq.data.documentReference;
      if (!docRefs) return;
      if (dq.status === "success") numberOfSuccesses++;

      const numberOfDocRefs = docRefs.length;
      numberOfDocuments += numberOfDocRefs;
      const contentTypes = countContentTypes(docRefs);
      mergeMaps(totalContentTypes, contentTypes);

      stats.push({
        contentTypes,
        numberOfDocRefs,
      });
    };

    await executeAsynchronously(dqResults, async dq => processDqResult(dq), {
      numberOfParallelExecutions: MAX_NUMBER_OF_PARALLEL_DQ_PROCESSING_REQUESTS,
    });

    return `${numberOfRows} document queries with ${numberOfSuccesses} successes (${
      (numberOfSuccesses / numberOfRows) * 100
    } % success rate). ${numberOfDocuments} documents found.\n${mapToString(totalContentTypes)}`;
  } catch (err) {
    console.error(err);
    throw new Error("Error while calculating DQ statistics.");
  } finally {
    sequelize.close();
  }
}
