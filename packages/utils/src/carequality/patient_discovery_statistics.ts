import * as dotenv from "dotenv";
dotenv.config();
// // keep that ^ on top
import { Address } from "@metriport/core/domain/address";
import { getStateEnum } from "@metriport/core/domain/geographic-locations";
import { PatientData } from "@metriport/core/domain/patient";
import { MPIMetriportAPI } from "@metriport/core/mpi/patient-mpi-metriport-api";
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

const patientSchema = z.object({
  name: z
    .array(
      z.object({
        family: z.string().optional(),
        given: z.array(z.string()).optional(),
      })
    )
    .optional(),
  gender: z.enum(["male", "female", "unknown"]).optional(),
  birthDate: z.string().optional(),
  address: z.array(
    z.object({
      line: z.array(z.string()).optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
    })
  ),
});

type Patient = z.infer<typeof patientSchema>;

const rowWithDataSchema = z.object({
  status: z.string(),
  data: z
    .object({
      patientResource: patientSchema.optional(),
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

export function patientDataFromResource(
  patientResource: Patient | undefined
): PatientData | undefined {
  if (!patientResource) return;
  const humanName = patientResource?.name;
  if (!humanName) return;
  const firstName = humanName[0]?.given?.join(" ");
  const lastName = humanName[0]?.family;
  const dob = patientResource.birthDate;
  const genderAtBirth = mapGender(patientResource.gender);
  const addresses = getPatientAddresses(patientResource);

  if (!firstName || !lastName || !dob || !genderAtBirth) return;
  if (!addresses.length) return;

  return {
    firstName,
    lastName,
    dob,
    genderAtBirth,
    address: addresses,
  };
}

function mapGender(string: string | undefined): "M" | "F" | undefined {
  if (string === "male") return "M";
  if (string === "female") return "F";
  return;
}

function getPatientAddresses(patientResource: Patient | undefined): Address[] {
  if (!patientResource) return [];
  const addresses: Address[] = [];
  for (const address of patientResource.address) {
    const state = address.state ? getStateEnum(address.state) : undefined;
    const line = address.line ? address.line.join(", ") : undefined;
    const city = address.city || undefined;
    const zip = address.postalCode || undefined;
    if (!state || !line || !city || !zip) continue;

    addresses.push({
      addressLine1: line,
      city,
      state,
      zip,
      country: address.country,
    });
  }
  return addresses;
}

main();
