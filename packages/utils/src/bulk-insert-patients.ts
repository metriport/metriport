import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { MetriportMedicalApi, PatientCreate } from "@metriport/api-sdk";
import { PatientPayload } from "@metriport/core/command/patient-import/patient-import";
import { createPatientPayload } from "@metriport/core/command/patient-import/patient-import-shared";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { errorToString } from "@metriport/core/util/error/shared";
import { sleep } from "@metriport/core/util/sleep";
import { Command } from "commander";
import csv from "csv-parser";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import path from "path";
import { buildGetDirPathInside, initRunsFolder } from "./shared/folder";
import { getCxData } from "./shared/get-cx-data";
import { logNotDryRun } from "./shared/log";

dayjs.extend(duration);

/**
 * This script will read patients from a .csv file and insert them into the Metriport API.
 *
 * Format of the .csv file:
 * - first line contains column names
 * - columns can be in any order
 * - minimum columns: firstname,lastname,dob,gender,zip,city,state,address1,address2,phone,email,externalId
 * - it may contain more columns, only those above will be used
 *
 * Either set the env vars below on the OS or create a .env file in the root folder of this package.
 *
 * Execute this with:
 * $ npm run bulk-insert -- --dryrun
 * $ npm run bulk-insert
 */

/**
 * Only need to provide the facilityId if the CX has more than one facility.
 * Used to determine the NPI used to query CW.
 */
const facilityId: string = ""; // eslint-disable-line @typescript-eslint/no-inferrable-types

const apiKey = getEnvVarOrFail("API_KEY");
const apiUrl = getEnvVarOrFail("API_URL");
const cxId = getEnvVarOrFail("CX_ID");
const delayTime = dayjs.duration(5, "seconds").asMilliseconds();
const inputFileName = "bulk-insert-patients.csv";
const confirmationTime = dayjs.duration(10, "seconds");

const getFileName = buildGetDirPathInside(`bulk-insert`);

type Params = {
  dryrun?: boolean;
};
const program = new Command();
program
  .name("bulk-insert-patients")
  .description("CLI to import patients from a .csv file into the Metriport API.")
  .option(`--dryrun`, "Just validate the CSV without importing the patients")
  .showHelpAfterError();

const metriportAPI = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
});

async function main() {
  initRunsFolder();
  program.parse();
  const { dryrun: dryRunParam } = program.opts<Params>();
  const dryRun = dryRunParam ?? false;

  const { orgName, facilityId: localFacilityId } = await getCxData(cxId, facilityId.trim());
  if (!localFacilityId) throw new Error("No facility found");
  const outputFileName = getFileName(orgName) + ".txt";

  if (!dryRun) initPatientIdRepository(outputFileName);

  // This will insert all the patients into a specific facility.
  // Based off the apiKey it will determine the cx to add to the patients.
  const results: PatientCreate[] = [];
  fs.createReadStream(path.join(__dirname, inputFileName))
    .pipe(csv({ mapHeaders: ({ header }) => header.replaceAll(" ", "").replaceAll("*", "") }))
    .on("data", async data => {
      const metriportPatient = mapCSVPatientToMetriportPatient(data);
      if (metriportPatient) results.push(metriportPatient);
    })
    .on("end", async () => loadData(results, orgName, localFacilityId, outputFileName, dryRun));
}

async function loadData(
  results: PatientCreate[],
  orgName: string,
  localFacilityId: string,
  outputFileName: string,
  dryRun: boolean
) {
  const msg = `Loaded ${results.length} patients from the CSV file to be inserted at org/cx ${orgName}`;
  console.log(msg);
  if (dryRun) {
    console.log("Dry run, not inserting patients.");
    console.log(`List of patients: ${JSON.stringify(results, null, 2)}`);
    console.log(msg);
    console.log("Done.");
    return;
  }
  await displayWarningAndConfirmation(results, orgName, dryRun);
  let successfulCount = 0;
  const errors: Array<{ firstName: string; lastName: string; dob: string; message: string }> = [];

  for (const [i, patient] of results.entries()) {
    try {
      const createdPatient = await metriportAPI.createPatient(patient, localFacilityId, {
        rerunPdOnNewDemographics: true,
      });
      successfulCount++;
      console.log(i + 1, createdPatient);
      storePatientId(createdPatient.id, outputFileName);
      if (i < results.length - 1) await sleep(delayTime);
    } catch (error) {
      errors.push({
        firstName: patient.firstName,
        lastName: patient.lastName,
        dob: patient.dob,
        message: errorToString(error),
      });
    }
  }
  console.log(errors);
  console.log(`Done, inserted ${successfulCount} patients.`);
}

async function displayWarningAndConfirmation(results: unknown[], orgName: string, dryRun: boolean) {
  if (!dryRun) logNotDryRun();
  console.log(
    `Inserting ${
      results.length
    } patients at org/cx ${orgName} in ${confirmationTime.asSeconds()} seconds...`
  );
  await sleep(confirmationTime.asMilliseconds());
  console.log(`running...`);
}

function initPatientIdRepository(fileName: string) {
  const dirname = path.dirname(fileName);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
  fs.writeFileSync(fileName, "");
}

function storePatientId(patientId: string, fileName: string) {
  fs.appendFileSync(fileName, patientId + "\n");
}

const mapCSVPatientToMetriportPatient = (csvPatient: {
  firstname: string | undefined;
  lastname: string | undefined;
  dob: string | undefined;
  gender: string | undefined;
  city: string | undefined;
  state: string | undefined;
  zip: string | undefined;
  address1: string | undefined;
  addressLine1: string | undefined;
  address2: string | undefined;
  addressLine2: string | undefined;
  phone: string | undefined;
  phone1: string | undefined;
  phone2: string | undefined;
  email: string | undefined;
  email1: string | undefined;
  email2: string | undefined;
  id: string | undefined;
  externalId: string | undefined;
}): PatientPayload => {
  return createPatientPayload({
    firstname: csvPatient.firstname ?? "",
    lastname: csvPatient.lastname ?? "",
    dob: csvPatient.dob ?? "",
    gender: csvPatient.gender ?? "",
    addressline1: csvPatient.address1 ?? csvPatient.addressLine1 ?? "",
    addressline2: csvPatient.address2 ?? csvPatient.addressLine2,
    city: csvPatient.city ?? "",
    state: csvPatient.state ?? "",
    zip: csvPatient.zip ?? "",
    phone1: csvPatient.phone ?? csvPatient.phone1,
    phone2: csvPatient.phone2,
    email1: csvPatient.email ?? csvPatient.email1,
    email2: csvPatient.email2,
    externalid: csvPatient.externalId,
  });
};

main();
