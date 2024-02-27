import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { MetriportMedicalApi, USState, PatientCreate } from "@metriport/api-sdk";
import { Sequelize, QueryTypes } from "sequelize";
import { sleep } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import {
  pollOutboundDocQueryResults,
  pollOutboundDocRetrievalResults,
} from "@metriport/core/external/carequality/ihe-gateway/poll-outbound-results";

dayjs.extend(duration);

const apiUrl = getEnvVarOrFail("API_URL");
const apiKey = getEnvVarOrFail("API_KEY");
const sqlDBCreds = getEnvVarOrFail("DB_CREDS");
const cxId = getEnvVarOrFail("CX_ID");
const cqPatientDataTableName = "cq_patient_data";
const patientDiscoveryResultTableName = "patient_discovery_result";

const dbCreds = JSON.parse(sqlDBCreds);

const PATIENT_SLEEP = dayjs.duration({ minutes: 1 });
const DOC_STATUS_SLEEP = dayjs.duration({ minutes: 1 });

const facilityId: string = ""; // eslint-disable-line @typescript-eslint/no-inferrable-types

const metriportAPI = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
});

const sequelize = new Sequelize(dbCreds.dbname, dbCreds.username, dbCreds.password, {
  host: dbCreds.host,
  port: dbCreds.port,
  dialect: dbCreds.engine,
});

const testPatient: PatientCreate = {
  firstName: "NWHINONE",
  lastName: "NWHINZZZTESTPATIENT",
  dob: "1981-01-01",
  genderAtBirth: "M",
  personalIdentifiers: [],
  address: [
    {
      zip: "35080",
      addressLine1: "1100 Test Street",
      state: USState.AL,
      city: "Helena",
      country: "USA",
    },
  ],
};

async function main() {
  let patientId = "";

  try {
    console.log("Creating patient...");
    const newPatient = await metriportAPI.createPatient(testPatient, facilityId);

    patientId = newPatient.id;

    console.log("Created patient:", newPatient);

    await sleep(PATIENT_SLEEP.asMilliseconds());

    const cqPatientDataQuery = `SELECT * FROM ${cqPatientDataTableName} WHERE id = '${newPatient.id}'`;
    const cqPatientDataResults = await sequelize.query(cqPatientDataQuery, {
      type: QueryTypes.SELECT,
    });

    const cqPatientData = cqPatientDataResults[0] as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    console.log("cqPatientData:", cqPatientData);
    const links = cqPatientData.data.links;

    if (cqPatientDataResults.length === 0) {
      throw new Error(`Patient not found in ${cqPatientDataTableName}`);
    }

    console.log("Patient links found:", cqPatientDataResults[0]);

    const patientDiscoveryResults = await queryDbResults(
      patientDiscoveryResultTableName,
      newPatient.id
    );

    if (patientDiscoveryResults.length === 0) {
      throw new Error(`Patient not found in ${patientDiscoveryResultTableName}`);
    }

    console.log("Patient discovery results found:", patientDiscoveryResults);

    console.log("Start document query");

    const docQuery = await metriportAPI.startDocumentQuery(newPatient.id, facilityId);

    console.log("Document query started:", docQuery);

    const documentQueryResults = await pollOutboundDocQueryResults({
      patientId: newPatient.id,
      cxId,
      dbCreds: sqlDBCreds,
      requestId: docQuery.requestId ?? "",
      numOfGateways: links.length,
    });

    if (documentQueryResults.length === 0) {
      throw new Error("No document query results found");
    }

    console.log("Document query results found:", documentQueryResults);

    const documentRetrievalResults = await pollOutboundDocRetrievalResults({
      patientId: newPatient.id,
      cxId,
      dbCreds: sqlDBCreds,
      requestId: docQuery.requestId ?? "",
      numOfGateways: links.length,
    });

    if (documentRetrievalResults.length === 0) {
      throw new Error("No document retrieval results found");
    }

    console.log("Document retrieval results found:", documentRetrievalResults);

    await sleep(DOC_STATUS_SLEEP.asMilliseconds());

    const docQueryStatus = await metriportAPI.getDocumentQueryStatus(newPatient.id);

    console.log("Document query status:", docQueryStatus);
  } catch (error) {
    console.error("E2E validation failed:", error);
  }

  console.log("Deleting patient...");
  await metriportAPI.deletePatient(patientId, facilityId);

  console.log("E2E validation complete");
  process.exit(0);
}

async function queryDbResults(tableName: string, patientId: string) {
  const query = `SELECT * FROM ${tableName} WHERE patient_id = '${patientId}'`;
  const results = await sequelize.query(query, {
    type: QueryTypes.SELECT,
  });

  return results;
}

main();
