import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { executeAsynchronously } from "../../concurrency";
import { out } from "../../log";
import { initDBPool } from "../../sequelize";
import {
  StatisticsProps,
  calculateMapStats,
  countContentTypes,
  getQueryResults,
  mapToString,
  mergeMaps,
  tableNameHeader,
} from "./../shared";

const MAX_NUMBER_OF_PARALLEL_DR_PROCESSING_REQUESTS = 20;
const DR_TABLE_NAME = "document_retrieval_result";

type DrStatisticsOutput = {
  numDrRows: number;
  numDrSuccesses: number;
  drSuccessRate: string;
  patientsWithDocs: number;
  drCoverage: string;
  avgDocsPerPatient: number;
  totalDocsDownloaded: number;
};

/**
 * Returns statistics for DR, including the following:
 * 1) # of DRs
 * 2) # of success responses
 * 3) # of document downloads
 * 3) content types and their counts
 *
 * @param sqlDBCreds    The SQL database credentials.
 * @param cxId          The CX ID.
 * @param patientId     Optional, the patient ID. If not provided, the statistics will be calculated for all patients of the customer organization.
 * @param dateString    Optional, the date string. If provided, will return the results from the set date until present. If not provided, the statistics will be calculated for the 24 hr period starting at 25 hr ago.
 */
export async function getDrStatistics({
  sqlDBCreds,
  cxId,
  patientIds,
  dateString,
}: StatisticsProps): Promise<DrStatisticsOutput> {
  out("Starting DR statistics calculation...");
  const sequelize = initDBPool(sqlDBCreds);

  try {
    const baseQuery = `
  SELECT * FROM ${DR_TABLE_NAME} 
  WHERE data->>'cxId'=:cxId
  `;
    const drResults = await getQueryResults({
      sequelize,
      baseQuery,
      cxId,
      dateString,
      patientIds: { ids: patientIds },
    });
    const numRows = drResults.length;

    const stats: { contentTypes: Map<string, number>; numberOfDocRefs: number }[] = [];
    let numSuccesses = 0;
    let numDocs = 0;
    const contentTypesMap = new Map<string, number>();
    const docsPerPatientMap = new Map<string, number>();

    // TODO: define the type of `dr`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processDrResult = async (dr: any) => {
      const docRefs = dr.data.documentReference;
      if (!docRefs) return;
      if (dr.status === "success") numSuccesses++;
      const numDocRefs = docRefs.length;
      docsPerPatientMap.set(
        dr.patient_id,
        (docsPerPatientMap.get(dr.patient_id) || 0) + numDocRefs
      );
      numDocs += numDocRefs;
      const contentTypes = countContentTypes(docRefs);
      mergeMaps(contentTypesMap, contentTypes);
      stats.push({
        contentTypes,
        numberOfDocRefs: numDocRefs,
      });
    };

    await executeAsynchronously(drResults, async dr => processDrResult(dr), {
      numberOfParallelExecutions: MAX_NUMBER_OF_PARALLEL_DR_PROCESSING_REQUESTS,
    });

    const { numPatientsWithTargetAttribute: numPatients, avgAttributePerPatient: avgDownloads } =
      calculateMapStats(docsPerPatientMap);
    const successRate = ((numSuccesses / numRows) * 100).toFixed(2);
    const drCoverage = ((numPatients / patientIds.length) * 100).toFixed(2);

    const string = `${tableNameHeader(
      DR_TABLE_NAME
    )}${numPatients} patients with at least 1 document (${(
      (numPatients / patientIds.length) *
      100
    ).toFixed(
      2
    )}% coverage), with an average of ${avgDownloads} documents per patient.\n${numRows} document retrievals with ${numSuccesses} successes (${successRate} % success rate). ${numDocs} documents downloaded.\n${mapToString(
      contentTypesMap
    )}`;
    out(string);

    return {
      numDrRows: numRows,
      numDrSuccesses: numSuccesses,
      drSuccessRate: successRate,
      patientsWithDocs: numPatients,
      drCoverage,
      avgDocsPerPatient: avgDownloads,
      totalDocsDownloaded: numDocs,
    };
  } catch (err) {
    console.error(err);
    throw new Error("Error while calculating DR statistics.");
  } finally {
    sequelize.close();
  }
}
