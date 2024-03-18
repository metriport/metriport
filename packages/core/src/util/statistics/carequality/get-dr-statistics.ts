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
  tableNameHeader,
} from "./../shared";

const MAX_NUMBER_OF_PARALLEL_DR_PROCESSING_REQUESTS = 20;
const DR_TABLE_NAME = "document_retrieval_result";

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
}: StatisticsProps): Promise<string> {
  out("Starting DR statistics calculation...");
  const sequelize = initSequelizeForLambda(sqlDBCreds, false);

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
    const numberOfRows = drResults.length;

    const stats: { contentTypes: Map<string, number>; numberOfDocRefs: number }[] = [];
    let numberOfSuccesses = 0;
    let numberOfDocuments = 0;
    const totalContentTypes = new Map<string, number>();
    const numberOfDocumentsPerPatient = new Map<string, number>();

    // TODO: define the type of `dr`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processDrResult = async (dr: any) => {
      const docRefs = dr.data.documentReference;
      if (!docRefs) return;
      if (dr.status === "success") numberOfSuccesses++;
      const numberOfDocRefs = docRefs.length;
      numberOfDocumentsPerPatient.set(
        dr.patient_id,
        (numberOfDocumentsPerPatient.get(dr.patient_id) || 0) + numberOfDocRefs
      );
      numberOfDocuments += numberOfDocRefs;
      const contentTypes = countContentTypes(docRefs);
      mergeMaps(totalContentTypes, contentTypes);
      stats.push({
        contentTypes,
        numberOfDocRefs,
      });
    };

    await executeAsynchronously(drResults, async dr => processDrResult(dr), {
      numberOfParallelExecutions: MAX_NUMBER_OF_PARALLEL_DR_PROCESSING_REQUESTS,
    });

    const {
      numberOfPatientsWithTargetAttribute: numberOfPatients,
      avgAttributePerPatient: avgDownloads,
    } = calculateMapStats(numberOfDocumentsPerPatient);
    const successRate = ((numberOfSuccesses / numberOfRows) * 100).toFixed(2);

    return `${tableNameHeader(
      DR_TABLE_NAME
    )}${numberOfPatients} patients with at least 1 document (${(
      (numberOfPatients / patientIds.length) *
      100
    ).toFixed(
      2
    )}% coverage), with an average of ${avgDownloads} documents per patient.\n${numberOfRows} document retrievals with ${numberOfSuccesses} successes (${successRate} % success rate). ${numberOfDocuments} documents downloaded.\n${mapToString(
      totalContentTypes
    )}`;
  } catch (err) {
    console.error(err);
    throw new Error("Error while calculating DR statistics.");
  } finally {
    sequelize.close();
  }
}
