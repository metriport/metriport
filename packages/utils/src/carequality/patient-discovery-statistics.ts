import * as dotenv from "dotenv";
dotenv.config();
// // keep that ^ on top
import { patientDataFromResource } from "@metriport/core/external/carequality/pd/process-inbound-pd";
import { MPIMetriportAPI } from "@metriport/core/mpi/patient-mpi-metriport-api";
import { inboundPatientResourceSchema } from "@metriport/ihe-gateway-sdk/src/models/patient-discovery/patient-discovery-responses";
import { QueryTypes, Sequelize } from "sequelize";
import z from "zod";
import { getEnvVarOrFail } from "../../../api/src/shared/config";

const apiUrl = getEnvVarOrFail("API_URL");
const mpi = new MPIMetriportAPI(apiUrl);

const cxId = getEnvVarOrFail("CX_ID");
const sqlDBCreds = getEnvVarOrFail("DB_CREDS");
const dbCreds = JSON.parse(sqlDBCreds);
const sequelize = new Sequelize(dbCreds.dbname, dbCreds.username, dbCreds.password, {
  host: dbCreds.host,
  port: dbCreds.port,
  dialect: dbCreds.engine,
  logging: false,
});

const rowWithDataSchema = z.object({
  status: z.string(),
  data: z
    .object({
      patientResource: inboundPatientResourceSchema.optional(),
      timestamp: z.string(),
    })
    .optional(),
});

const patientId = "";

async function main() {
  const query = `
  SELECT * FROM patient_discovery_result
  WHERE data->>'cxId'='${cxId}'
  and created_at > '2024-03-07'
  `;
  const patientFilter = patientId ? `and patient_id='${patientId}'` : ``;
  const queryString = `${query} ${patientFilter};`;

  const resp = await sequelize.query(queryString, {
    type: QueryTypes.SELECT,
  });

  const numberOfRows = resp.length;
  let numberOfMatches = 0;
  let numberOfSuccesses = 0;
  let numberOfPatients = 0;
  await Promise.allSettled(
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    resp.map(async (r: any) => {
      if (Object.keys(r.data.patientResource).length == 0) delete r.data.patientResource;
      const row = rowWithDataSchema.parse(r);
      if (row.status === "success") numberOfSuccesses++;

      const patient = patientDataFromResource(row?.data?.patientResource);
      if (!patient) return;

      numberOfPatients++;
      const matchingPatient = await mpi.findMatchingPatient(patient);
      if (matchingPatient) {
        numberOfMatches++;
      }
    })
  );

  if (patientId) console.log(`For patientId ${patientId}.`);

  console.log(
    `${numberOfSuccesses} successful matches / ${numberOfRows} PD discovery results. 
${numberOfMatches} MPI matches / ${numberOfPatients} returned patients.`
  );
}

main();
