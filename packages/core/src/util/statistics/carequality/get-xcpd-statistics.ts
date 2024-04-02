import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { inboundPatientResourceSchema } from "@metriport/ihe-gateway-sdk";
import { Sequelize } from "sequelize";
import z from "zod";
import { mapPatientResourceToPatientData } from "../../../external/carequality/pd/process-inbound-pd";
import { MPIMetriportAPI } from "../../../mpi/patient-mpi-metriport-api";
import { executeAsynchronously } from "../../concurrency";
import { out } from "../../log";
import { initDBPool } from "../../sequelize";
import {
  BaseStatisticsProps,
  calculateMapStats,
  getQueryResults,
  tableNameHeader,
} from "./../shared";

const MAX_NUMBER_OF_PARALLEL_XCPD_PROCESSING_REQUESTS = 20;
const CQ_DATA_TABLE_NAME = "cq_patient_data";
const PD_TABLE_NAME = "patient_discovery_result";

export const rowWithDataSchema = z.object({
  status: z.string(),
  data: z
    .object({
      patientResource: inboundPatientResourceSchema.optional(),
      timestamp: z.string(),
    })
    .optional(),
});

const cqLinksSchema = z.array(
  z.object({
    id: z.string(),
    cx_id: z.string(),
    data: z.object({
      links: z.array(z.object({})).optional(),
    }),
  })
);

type XcpdStatisticsProps = BaseStatisticsProps & { apiUrl: string; patientId?: string };
type XcpdStatisticsOutput = {
  numRows: number;
  numSuccesses: number;
  uniquePatients: number;
  parsedPatients: number;
  patientsWithLinks: number;
  coverageRate: string;
  avgLinksPerPatient: number;
  patientResources: number;
  mpiMatches: number;
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
 * @param patientId     Optional, the patient ID. If not provided, the statistics will be calculated for all patients of the customer organization.
 * @param dateString    Optional, the date string. If provided, will return the results from the set date until present. If not provided, the statistics will be calculated for the 24 hr period starting at 25 hr ago.
 */
export async function getXcpdStatistics({
  apiUrl,
  sqlDBCreds,
  cxId,
  patientIds,
  dateString,
}: XcpdStatisticsProps): Promise<{ patients: string[]; stats: XcpdStatisticsOutput }> {
  out(
    `Starting XCPD statistics calculation ${patientIds ? `For patient IDs: ${patientIds}.` : ""}...`
  );
  const mpi = new MPIMetriportAPI(apiUrl);
  const sequelize = initDBPool(sqlDBCreds);

  try {
    const baseQuery = `
  SELECT * FROM ${PD_TABLE_NAME}
  WHERE data->>'cxId'=:cxId
  `;

    const pdResults = await getQueryResults({
      sequelize,
      baseQuery,
      cxId,
      dateString,
      patientIds: { ids: patientIds },
    });
    const numRows = pdResults.length;
    const numLinksPerPatient = new Map<string, number>();

    const patients = new Set<string>();
    let mpiMatches = 0;
    let numSuccesses = 0;
    let numParsedPatients = 0;
    let numPatientResources = 0;

    // TODO: define the type of `dr`
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processXcpdResult = async (pd: any) => {
      if (!patients.has(pd["patient_id"])) {
        patients.add(pd["patient_id"]);
      }

      if (!pd.data.patientResource) return;
      numPatientResources++;

      if (Object.keys(pd.data.patientResource).length == 0) delete pd.data.patientResource;
      numSuccesses++;

      const row = rowWithDataSchema.parse(pd);
      if (row.status !== "success") return;

      numLinksPerPatient.set(pd["patient_id"], (numLinksPerPatient.get(pd["patient_id"]) || 0) + 1);

      const patient = mapPatientResourceToPatientData(row.data?.patientResource);
      if (!patient) return;

      numParsedPatients++;
      const matchingPatient = await mpi.findMatchingPatient(patient);
      if (matchingPatient) {
        mpiMatches++;
      }
    };

    await executeAsynchronously(pdResults, async pd => processXcpdResult(pd), {
      numberOfParallelExecutions: MAX_NUMBER_OF_PARALLEL_XCPD_PROCESSING_REQUESTS,
    });

    const {
      numPatientsWithTargetAttribute: numPatientsWithLinks,
      avgAttributePerPatient: avgLinksPerPatient,
    } = calculateMapStats(numLinksPerPatient);
    const coverageRate = ((numPatientsWithLinks / patients.size) * 100).toFixed(2);
    const patientsArray = [...patients];

    const {
      numberOfPatientsWithTargetAttribute: numberOfPatientsWithLinks,
      avgAttributePerPatient: avgLinksPerPatientCqData,
    } = await calculateNumberOfLinksPerPatient({
      sequelize,
      cxId,
      patientIds: patientsArray,
      dateString,
    });

    const string = `${tableNameHeader(
      PD_TABLE_NAME
    )}We received ${numRows} PD discovery results with ${numSuccesses} successful matches. 
For the ${
      patients.size
    } unique patients, we got ${numPatientsWithLinks} patients with at least 1 link (${coverageRate}% coverage), and an average of ${avgLinksPerPatient} links per patient.
Of the ${numPatientResources} returned patient resources, we parsed ${numParsedPatients} patients and got ${mpiMatches} MPI matches.
${tableNameHeader(
  CQ_DATA_TABLE_NAME
)}${numberOfPatientsWithLinks} patients with at least 1 link, with an average of ${avgLinksPerPatientCqData} per patient.`;

    out(string);
    const stats = {
      numRows,
      numSuccesses,
      uniquePatients: patients.size,
      parsedPatients: numParsedPatients,
      patientsWithLinks: numPatientsWithLinks,
      coverageRate,
      avgLinksPerPatient,
      patientResources: numPatientResources,
      mpiMatches,
    };
    return { patients: patientsArray, stats };
  } catch (err) {
    console.error(err);
    throw new Error("Error while calculating XCPD statistics.");
  } finally {
    sequelize.close();
  }
}

async function queryCqPatientDataForLinks({
  sequelize,
  cxId,
  dateString,
  patientIds,
}: {
  sequelize: Sequelize;
  cxId: string;
  patientIds: {
    ids: string[];
    columnName: string;
  };
  dateString?: string | undefined;
}) {
  const baseQuery = `
  SELECT * FROM ${CQ_DATA_TABLE_NAME}
  WHERE cx_id=:cxId
  `;

  const response = getQueryResults({ sequelize, baseQuery, cxId, dateString, patientIds });
  return response;
}

async function calculateNumberOfLinksPerPatient({
  sequelize,
  cxId,
  patientIds,
  dateString,
}: {
  sequelize: Sequelize;
  cxId: string;
  patientIds: string[];
  dateString?: string | undefined;
}) {
  const linksResults = await queryCqPatientDataForLinks({
    sequelize,
    cxId,
    patientIds: {
      ids: patientIds,
      columnName: "id",
    },
    dateString,
  });
  const cqLinks = cqLinksSchema.parse(linksResults);
  const numberOfCqLinksPerPatient = new Map<string, number>();

  cqLinks.map(result => {
    const numberOfLinks = result.data.links ? result.data.links.length : 0;
    numberOfCqLinksPerPatient.set(
      result["id"],
      (numberOfCqLinksPerPatient.get(result["id"]) || 0) + numberOfLinks
    );
  });
  const {
    numPatientsWithTargetAttribute: numberOfPatientsWithTargetAttribute,
    avgAttributePerPatient,
  } = calculateMapStats(numberOfCqLinksPerPatient);

  return { numberOfPatientsWithTargetAttribute, avgAttributePerPatient };
}
