import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { executeAsynchronously } from "../../concurrency";
import { out } from "../../log";
import { initSequelizeForLambda } from "../../sequelize";
import {
  StatisticsProps,
  calculateMapStats,
  countContentTypes,
  getQueryResults,
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
 * @param dateString    Optional, The date string. If provided, will return the results from the set date until present. If not provided, the statistics will be calculated for the 24 hr period starting at 25 hr ago.
 */
export async function getDqStatistics({
  sqlDBCreds,
  cxId,
  patientId,
  dateString,
}: StatisticsProps): Promise<string> {
  out("Starting DQ statistics calculation...");
  const sequelize = initSequelizeForLambda(sqlDBCreds, false);

  try {
    const baseQuery = `
  SELECT * FROM document_query_result 
  WHERE data->>'cxId'=:cxId
  `;

    const dqResults = await getQueryResults(sequelize, baseQuery, cxId, dateString, patientId);

    const numberOfRows = dqResults.length;

    const stats: { contentTypes: Map<string, number>; numberOfDocRefs: number }[] = [];
    let numberOfSuccesses = 0;
    let numberOfDocuments = 0;
    const totalContentTypes = new Map<string, number>();
    const numberOfDocumentsPerPatient = new Map<string, number>();

    // TODO: define the type of `dq`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processDqResult = async (dq: any) => {
      const docRefs = dq.data.documentReference;
      if (!docRefs) return;
      if (dq.status === "success") numberOfSuccesses++;

      const numberOfDocRefs = docRefs.length;
      numberOfDocumentsPerPatient.set(
        dq.patient_id,
        numberOfDocumentsPerPatient.get(dq.patient_id) || 0 + numberOfDocRefs
      );
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

    const {
      numberOfPatientsWithTargetAttribute: numberOfLinked,
      avgAttributePerPatient: avgLinks,
    } = calculateMapStats(numberOfDocumentsPerPatient);
    const successRate = ((numberOfSuccesses / numberOfRows) * 100).toFixed(2);

    return `${numberOfLinked} patients with at least 1 document, with an average of ${avgLinks} documents per patient.
${numberOfRows} document queries with ${numberOfSuccesses} successes (${successRate} % success rate). ${numberOfDocuments} documents found.\n${mapToString(
      totalContentTypes
    )}`;
  } catch (err) {
    console.error(err);
    throw new Error("Error while calculating DQ statistics.");
  } finally {
    sequelize.close();
  }
}
