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
import { initSequelizeForLambda } from "../../sequelize";
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
}: XcpdStatisticsProps): Promise<{ string: string; patients: string[] }> {
  out(
    `Starting XCPD statistics calculation ${patientIds ? `For patient IDs: ${patientIds}.` : ""}...`
  );
  const mpi = new MPIMetriportAPI(apiUrl);
  const sequelize = initSequelizeForLambda(sqlDBCreds, false);

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
    const numberOfRows = pdResults.length;
    const numberOfLinksPerPatient = new Map<string, number>();

    const patients = new Set<string>();
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

      numberOfLinksPerPatient.set(
        pd["patient_id"],
        (numberOfLinksPerPatient.get(pd["patient_id"]) || 0) + 1
      );

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

    const {
      numberOfPatientsWithTargetAttribute: numberOfPatientsWithDocuments,
      avgAttributePerPatient: avgDocumentsPerPatient,
    } = calculateMapStats(numberOfLinksPerPatient);
    const coverageRate = ((numberOfPatientsWithDocuments / patients.size) * 100).toFixed(2);
    const patientsArray = [...patients];

    const { numberOfPatientsWithLinks, avgLinksPerPatient } =
      await calculateNumberOfLinksPerPatient({
        sequelize,
        cxId,
        patientIds: patientsArray,
        dateString,
      });

    const string = `${tableNameHeader(
      PD_TABLE_NAME
    )}We received ${numberOfRows} PD discovery results with ${numberOfSuccesses} successful matches. 
For the ${
      patients.size
    } unique patients, we got ${numberOfPatientsWithDocuments} patients with at least 1 link (${coverageRate}% coverage), and an average of ${avgDocumentsPerPatient} links per patient.
Of the ${numberOfPatientResources} returned patient resources, we parsed ${numberOfPatients} patients and got ${numberOfMatches} MPI matches.
${tableNameHeader(
  CQ_DATA_TABLE_NAME
)}${numberOfPatientsWithLinks} patients with at least 1 link, with an average of ${avgLinksPerPatient} per patient.`;
    return { string, patients: patientsArray };
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
    numberOfPatientsWithTargetAttribute: numberOfPatientsWithLinks,
    avgAttributePerPatient: avgLinksPerPatient,
  } = calculateMapStats(numberOfCqLinksPerPatient);

  return { numberOfPatientsWithLinks, avgLinksPerPatient };
}
