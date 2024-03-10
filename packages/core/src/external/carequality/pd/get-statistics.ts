import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { inboundPatientResourceSchema } from "@metriport/ihe-gateway-sdk";
import { QueryTypes } from "sequelize";
import z from "zod";
import { MPIMetriportAPI } from "../../../mpi/patient-mpi-metriport-api";
import { executeAsynchronously } from "../../../util/concurrency";
import { initSequelizeForLambda } from "../../../util/sequelize";
import { mapPatientResourceToPatientData } from "./process-inbound-pd";

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

type QueryReplacements = {
  cxId: string;
  dateString?: string;
  patientId?: string;
};

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
 * @param dateString    The date string.
 * @param patientId     Optional, the patient ID. If not provided, the statistics will be calculated for all patients of the customer organization.
 */
export async function getXcpdStatisticsForPatient(
  apiUrl: string,
  sqlDBCreds: string,
  cxId: string,
  dateString?: string,
  patientId?: string
): Promise<string> {
  console.log("Starting XCPD statistics calculation...");
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
    query += `and created_at>:dateString`;
    replacements.dateString = dateString;
  }

  if (patientId) {
    query += `and patient_id=:patientId`;
    replacements.patientId = patientId;
  }

  query += ";";

  try {
    const pdResults = await sequelize.query(query, {
      replacements: replacements,
      type: QueryTypes.SELECT,
    });

    const numberOfRows = pdResults.length;
    let numberOfMatches = 0;
    let numberOfSuccesses = 0;
    let numberOfPatients = 0;
    let numberOfPatientResources = 0;

    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getXcpdStatistics = async (pd: any) => {
      if (Object.keys(pd.data.patientResource).length == 0) delete pd.data.patientResource;
      if (pd.data.patientResource) numberOfPatientResources++;

      const row = rowWithDataSchema.parse(pd);
      if (row.status === "success") numberOfSuccesses++;

      const patient = mapPatientResourceToPatientData(row.data?.patientResource);
      if (!patient) return;

      numberOfPatients++;
      const matchingPatient = await mpi.findMatchingPatient(patient);
      if (matchingPatient) {
        numberOfMatches++;
      }
    };

    await executeAsynchronously(pdResults, async pd => getXcpdStatistics(pd), {
      numberOfParallelExecutions: MAX_NUMBER_OF_PARALLEL_XCPD_PROCESSING_REQUESTS,
    });

    if (patientId) console.log(`For patientId ${patientId}.`);

    return `${numberOfRows} PD discovery results with ${numberOfSuccesses} successful matches. 
Of the ${numberOfPatientResources} returned patient resources, we parsed ${numberOfPatients} patients and got ${numberOfMatches} MPI matches.`;
  } catch (err) {
    console.error(err);
    throw new Error("Error while calculating XCPD statistics.");
  } finally {
    sequelize.close();
  }
}
