import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { executeAsynchronously } from "../../concurrency";
import { out } from "../../log";
import { initDbPool } from "../../sequelize";
import {
  StatisticsProps,
  calculateMapStats,
  countContentTypes,
  getQueryResults,
  mapToString,
  mergeMaps,
  tableNameHeader,
} from "../shared";

const MAX_NUMBER_OF_PARALLEL_DQ_PROCESSING_REQUESTS = 20;
const DQ_TABLE_NAME = "document_query_result";

type DqStatisticsOutput = {
  numDqRows: number;
  numDqSuccesses: number;
  patientsWithDocs: number;
  dqCoverage: string;
  dqSuccessRate: string;
  avgDocsPerPatient: number;
  totalDocsFound: number;
};
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
  patientIds,
  dateString,
}: StatisticsProps): Promise<DqStatisticsOutput> {
  out("Starting DQ statistics calculation...");
  const sequelize = initDbPool(sqlDBCreds);

  try {
    const baseQuery = `
  SELECT * FROM ${DQ_TABLE_NAME} 
  WHERE data->>'cxId'=:cxId
  `;

    const dqResults = await getQueryResults({
      sequelize,
      baseQuery,
      cxId,
      dateString,
      patientIds: {
        ids: patientIds,
      },
    });

    const numberOfRows = dqResults.length;

    const stats: { contentTypes: Map<string, number>; numberOfDocRefs: number }[] = [];
    let numSuccesses = 0;
    let numDocs = 0;
    const contentTypesMap = new Map<string, number>();
    const docsPerPatientMap = new Map<string, number>();

    // TODO: define the type of `dq`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processDqResult = async (dq: any) => {
      const docRefs = dq.data.documentReference;
      if (!docRefs) return;
      if (dq.status === "success") numSuccesses++;

      const numberOfDocRefs = docRefs.length;
      docsPerPatientMap.set(
        dq.patient_id,
        (docsPerPatientMap.get(dq.patient_id) || 0) + numberOfDocRefs
      );
      numDocs += numberOfDocRefs;
      const contentTypes = countContentTypes(docRefs);
      mergeMaps(contentTypesMap, contentTypes);

      stats.push({
        contentTypes,
        numberOfDocRefs,
      });
    };

    await executeAsynchronously(dqResults, async dq => processDqResult(dq), {
      numberOfParallelExecutions: MAX_NUMBER_OF_PARALLEL_DQ_PROCESSING_REQUESTS,
    });

    const {
      numPatientsWithTargetAttribute: numberOfPatients,
      avgAttributePerPatient: avgDocsPerPatient,
    } = calculateMapStats(docsPerPatientMap);
    const successRate = ((numSuccesses / numberOfRows) * 100).toFixed(2);
    const coverage = ((numberOfPatients / patientIds.length) * 100).toFixed(2);

    const string = `${tableNameHeader(
      DQ_TABLE_NAME
    )}${numberOfPatients} patients with at least 1 document (${coverage}% coverage), with an average of ${avgDocsPerPatient} documents per patient.
    ${numberOfRows} document queries with ${numSuccesses} successes (${successRate} % success rate). ${numDocs} documents found.\n${mapToString(
      contentTypesMap
    )}`;
    out(string);
    return {
      numDqRows: numberOfRows,
      numDqSuccesses: numSuccesses,
      patientsWithDocs: numberOfPatients,
      dqCoverage: coverage,
      dqSuccessRate: successRate,
      avgDocsPerPatient,
      totalDocsFound: numDocs,
    };
  } catch (err) {
    console.error(err);
    throw new Error("Error while calculating DQ statistics.");
  } finally {
    sequelize.close();
  }
}
