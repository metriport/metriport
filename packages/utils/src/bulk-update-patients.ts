import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Address, MetriportMedicalApi, PatientDTO, USState } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { sleep } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { chunk } from "lodash";
import { QueryTypes, Sequelize } from "sequelize";
import z from "zod";

dayjs.extend(duration);

const apiKey = getEnvVarOrFail("API_KEY");
const apiUrl = getEnvVarOrFail("API_URL");
const sqlDBCreds = getEnvVarOrFail("DB_CREDS"); // Must use the read replica
const cxId = getEnvVarOrFail("CX_ID");
const CHUNK_DELAY_MAX_MS = dayjs.duration({ minutes: 1 }).asMilliseconds();
const PATIENT_CHUNK_SIZE = 5;

const dateString = ""; // YYYY-MM-DD format

const metriportAPI = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
});

const cqPatientDataResultSchema = z.array(
  z.object({
    id: z.string(),
    cx_id: z.string(),
    data: z.object({
      links: z.array(z.object({ oid: z.string(), url: z.string() })),
    }),
    created_at: z.date(),
  })
);
type CqPatientDataResult = z.infer<typeof cqPatientDataResultSchema>;

/**
 * This script looks at all of the patients created after a certain date and triggers the UPDATE PATIENT
 * for those patients, who do not have a link in the cq_patient_data table.
 *
 * To run:
 * 1. Set the env vars:
 *  -CX_ID
 *  -API_KEY
 *  -API_URL
 *  -DB_CREDS - Must use the read replica
 * 2. Set the date string in the format YYYY-MM-DD
 * 3. Run the script with `ts-node src/bulk-update-patients.ts`
 */
async function main() {
  const dbCreds = JSON.parse(sqlDBCreds);
  if (!dateString) {
    console.log("Please provide a date string in the format YYYY-MM-DD");
    return;
  }
  const targetDate = new Date(dateString);

  const sequelize = new Sequelize(dbCreds.dbname, dbCreds.username, dbCreds.password, {
    host: dbCreds.host,
    port: dbCreds.port,
    dialect: dbCreds.engine,
  });

  try {
    const facilities = await metriportAPI.listFacilities();
    const patientCQLinks = await getPatientCqLinks(sequelize, cxId);

    let totalFacilities = 0;
    let totalPatients = 0;
    let patientsNoLinks = 0;

    for (let i = 0; i < facilities.length; i++) {
      const facility = facilities[i];
      totalFacilities++;
      const patientsList = await metriportAPI.listPatients(facility.id);

      const patientsCreatedAfter = patientsList.filter(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        patient => new Date(patient.dateCreated!) > targetDate
      );

      totalPatients += patientsCreatedAfter.length;

      const patientsWithNoLinks = [];

      for (const patient of patientsCreatedAfter) {
        const hasPatientLinks = patientCQLinks.filter(link => link.id === patient.id);
        if (hasPatientLinks.length > 0) {
          continue;
        }

        patientsWithNoLinks.push(patient);
        patientsNoLinks++;
      }

      const patientChunks = chunk(patientsWithNoLinks, PATIENT_CHUNK_SIZE);
      console.log(`Facility ${facility.id} has ${patientsWithNoLinks.length} patients`);

      for (const [i, patients] of patientChunks.entries()) {
        console.log(`Chunk ${i + 1} of ${patientChunks.length}`);
        console.log(`# of patients ${patients.length}`);

        for (const patient of patients) {
          console.log(`Updating patient ${patient.id}`);
          const addressObject = Array.isArray(patient.address)
            ? patient.address[0]
            : patient.address;
          const address = addressObject as Address;
          await updatePatient(patient, address, facility.id);
        }
        if (i < patientChunks.length - 1) {
          await sleep(CHUNK_DELAY_MAX_MS * patients.length);
        }
      }
      if (i < facilities.length - 1) {
        await sleep(CHUNK_DELAY_MAX_MS);
      }
    }

    console.log(`Total facilities: ${totalFacilities}`);
    console.log(`Total patients: ${totalPatients}`);
    console.log(`Patients with no links: ${patientsNoLinks}`);
  } catch (err) {
    console.error(err);
  } finally {
    sequelize.close();
  }
}

main();

async function getPatientCqLinks(sequelize: Sequelize, cxId: string): Promise<CqPatientDataResult> {
  const query = `SELECT * FROM cq_patient_data WHERE cx_id=:cxId`;
  const patientResults = await sequelize.query(query, {
    replacements: { cxId },
    type: QueryTypes.SELECT,
  });

  const patientCQLinks = cqPatientDataResultSchema.parse(patientResults);
  return patientCQLinks;
}

async function updatePatient(patient: PatientDTO, address: Address, facilityId: string) {
  await metriportAPI.updatePatient(
    {
      id: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      dob: patient.dob,
      genderAtBirth: patient.genderAtBirth,
      address: [
        {
          state: address.state as USState,
          city: address.city,
          country: "USA",
          addressLine1: address.addressLine1,
          ...(address.addressLine2 && { addressLine2: address.addressLine2 }),
          zip: address.zip,
        },
      ],
    },
    facilityId
  );
}
