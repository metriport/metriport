import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { inboundPatientResourceSchema } from "@metriport/ihe-gateway-sdk";
import { QueryTypes } from "sequelize";
import z from "zod";
import { mapPatientResourceToPatientData } from "../../../external/carequality/pd/process-inbound-pd";
import { MPIMetriportAPI } from "../../../mpi/patient-mpi-metriport-api";
import { executeAsynchronously } from "../../concurrency";
import { out } from "../../log";
import { initSequelizeForLambda } from "../../sequelize";
import { QueryReplacements, StatisticsProps, getYesterdaysTimeFrame } from "./../shared";

const MAX_NUMBER_OF_PARALLEL_XCPD_PROCESSING_REQUESTS = 20;

export const rowWithDataSchema = z.object({
  status: z.string(),
  data: z
    .object({
      patientResource: inboundPatientResourceSchema.optional(),
      timestamp: z.string(),
    })
    .optional(),
});

type XcpdStatisticsProps = StatisticsProps & { apiUrl: string };

/**
 * Returns statistics for XCPD, including the following:
 * 1) # of PDs
 * 2) # of success responses
 * 3) # of parsed patients
 * 4) # of mpi matches
 *
 * @param apiUrl        The URL of the API.
 * @param sqlDBCreds    The SQL database credentials.
 * @param cxId          The CX ID.
 * @param patientId     Optional, the patient ID. If not provided, the statistics will be calculated for all patients of the customer organization.
 * @param dateString    Optional, the date string. If provided, will return the results from the set date until present. If not provided, the statistics will be calculated for the 24 hr period starting at 25 hr ago.
 */
export async function getXcpdStatistics({
  apiUrl,
  sqlDBCreds,
  cxId,
  patientId,
  dateString,
}: XcpdStatisticsProps): Promise<string> {
  out(`Starting XCPD statistics calculation ${patientId ? `For patientId ${patientId}.` : ""}...`);
  const mpi = new MPIMetriportAPI(apiUrl);
  const sequelize = initSequelizeForLambda(sqlDBCreds, false);

  let query = `
  SELECT * FROM patient_discovery_result
  WHERE data->>'cxId'=:cxId
  `;

  const replacements: QueryReplacements = {
    cxId: cxId,
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
    const pdResults = await sequelize.query(query, {
      replacements: replacements,
      type: QueryTypes.SELECT,
    });

    const numberOfRows = pdResults.length;

    const patients = new Set();
    let numberOfMatches = 0;
    let numberOfSuccesses = 0;
    let numberOfPatients = 0;
    let numberOfPatientResources = 0;

    // TODO: define the type of `dr`
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processXcpdResult = async (pd: any) => {
      if (!patients.has(pd["patient_id"])) {
        patients.add(pd["patient_id"]);
      }

      if (!pd.data.patientResource) return;
      numberOfPatientResources++;

      if (Object.keys(pd.data.patientResource).length == 0) delete pd.data.patientResource;
      numberOfSuccesses++;

      const row = rowWithDataSchema.parse(pd);
      if (row.status !== "success") return;

      const patient = mapPatientResourceToPatientData(row.data?.patientResource);
      if (!patient) return;

      numberOfPatients++;
      const matchingPatient = await mpi.findMatchingPatient(patient);
      if (matchingPatient) {
        numberOfMatches++;
      }
    };

    await executeAsynchronously(pdResults, async pd => processXcpdResult(pd), {
      numberOfParallelExecutions: MAX_NUMBER_OF_PARALLEL_XCPD_PROCESSING_REQUESTS,
    });

    if (patientId) console.log(`For patientId ${patientId}.`);

    return `For ${patients.size} unique patients, we got ${numberOfRows} PD discovery results with ${numberOfSuccesses} successful matches. 
Of the ${numberOfPatientResources} returned patient resources, we parsed ${numberOfPatients} patients and got ${numberOfMatches} MPI matches.`;
  } catch (err) {
    console.error(err);
    throw new Error("Error while calculating XCPD statistics.");
  } finally {
    sequelize.close();
  }
}
