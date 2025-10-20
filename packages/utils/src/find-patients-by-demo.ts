import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { MetriportMedicalApi, PatientCreate, PatientDTO } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { sleep } from "@metriport/core/util/sleep";
import { getEnvVar } from "@metriport/shared";
import { Command } from "commander";
import csv from "csv-parser";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { initPatientIdRepository, mapCsvPatientToMetriportPatient } from "./bulk-insert-patients";
import { elapsedTimeAsStr } from "./shared/duration";
import { buildGetDirPathInside, initRunsFolder } from "./shared/folder";
import { getCxData } from "./shared/get-cx-data";
import { dedupPatientCreatesReturnDuplicates, storePatientCreates } from "./shared/patient-create";
import { mapHeadersForCsvParser } from "./csv/shared";

dayjs.extend(duration);

/**
 * This script finds patients by matching demographic data from a CSV file against the Metriport API.
 *
 * Format of the CSV file:
 * - First line must contain column headers
 * - Columns can be in any order
 * - Required columns: firstname, lastname, dob, gender, zip, city, state, address1, address2, phone, email, externalId
 * - Additional columns will be ignored
 *
 * Environment variables can be set either in the OS or in a .env file in the package root.
 *
 * Usage:
 * $ npm run find-patients -- --dryrun  # Validate CSV without querying API
 * $ npm run find-patients              # Find matching patients
 *
 * Output:
 * - Creates a timestamped folder under runs/patients-by-demo/<org-name>
 * - Generates JSON files:
 *   - matches.json: Patients found in the system
 *   - no-matches.json: Patients not found
 *   - multiple-matches.json: Patients with multiple matches
 * - Generates SQL file:
 *   - patient-update.sql: SQL queries used for demographic matching
 */

// Full path to the file
const inputFileName = "";

const apiKey = getEnvVarOrFail("API_KEY");
const apiUrl = getEnvVarOrFail("API_URL");
const cxId = getEnvVarOrFail("CX_ID");
/**
 * Only need to provide the facilityId if the CX has more than one facility.
 */
const facilityId = getEnvVar("FACILITY_ID") ?? "";
const confirmationTime = dayjs.duration(10, "seconds");
const columnSeparator = ",";

const getFolderName = buildGetDirPathInside(`patients-by-demo`);

type Params = {
  dryrun?: boolean;
};
const program = new Command();
program
  .name("find-patients-by-demo")
  .description("CLI to find patients by demo data.")
  .option(`--dryrun`, "Just validate the CSV without running the query")
  .showHelpAfterError();

const metriportAPI = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
});

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();

  program.parse();
  const { dryrun: dryRunParam } = program.opts<Params>();
  const dryRun = dryRunParam ?? false;
  console.log(
    `############## Started at ${new Date(startedAt).toISOString()} ############## ${
      dryRun ? "DRY RUN" : ""
    }`
  );

  initRunsFolder();

  const { orgName, facilityId: localFacilityId } = await getCxData(cxId, facilityId.trim());
  if (!localFacilityId) throw new Error("No facility found");
  const outputFolderName = getFolderName(orgName);

  initPatientIdRepository(outputFolderName);

  // This will insert all the patients into a specific facility.
  // Based off the apiKey it will determine the cx to add to the patients.
  const patientsFromCsv: { raw: string[]; create: PatientCreate }[] = [];
  const mappingErrors: Array<{ row: string; errors: string }> = [];
  const fileName = inputFileName;

  fs.createReadStream(fileName)
    .pipe(csv({ mapHeaders: mapHeadersForCsvParser }))
    .on("data", async data => {
      const result = mapCsvPatientToMetriportPatient(data);
      if (Array.isArray(result)) {
        mappingErrors.push({
          row: JSON.stringify(data),
          errors: result.map(e => e.error).join("; "),
        });
      } else {
        const raw = Object.values(data) as string[];
        const rawNormalized = raw.map(r => (r.includes(columnSeparator) ? `"${r}"` : r));
        patientsFromCsv.push({ raw: rawNormalized, create: result });
      }
    })
    .on("end", async () => {
      if (mappingErrors.length > 0) {
        const errorFilePath = `${outputFolderName}/mapping-errors.json`;
        fs.writeFileSync(errorFilePath, JSON.stringify(mappingErrors, null, 2));
        throw new Error(
          `Found ${mappingErrors.length} mapping errors. Check ${errorFilePath} for details.`
        );
      }
      await findPatientsByDemo(patientsFromCsv, orgName, localFacilityId, outputFolderName, dryRun);
      console.log(`>>>>>>> Done after ${elapsedTimeAsStr(startedAt)}`);
    });
}

async function findPatientsByDemo(
  patientsFromCsv: { raw: string[]; create: PatientCreate }[],
  orgName: string,
  localFacilityId: string,
  outputFolderName: string,
  dryRun: boolean
) {
  console.log(`Loaded ${patientsFromCsv.length} patients from the CSV, processing them...`);
  const patientCreates = patientsFromCsv.map(p => p.create);

  const dupExternalIds = findDuplicateExternalIds(patientCreates);
  console.log(`- ${dupExternalIds.length} duplicate externalIds`);

  const { uniquePatients, duplicates } = dedupPatientCreatesReturnDuplicates(patientCreates);
  console.log(`- ${duplicates.length} duplicate patients`);

  const msg = `- ${uniquePatients.length} unique patients from the CSV file to be searched on/updated at org/cx ${orgName}`;
  console.log(msg);

  storePatientCreates(uniquePatients, outputFolderName + "/patients-from-csv.json");
  storePatientCreates(duplicates, outputFolderName + "/duplicates.json");
  if (dupExternalIds.length > 0) {
    fs.writeFileSync(
      `${outputFolderName}/duplicate-external-ids.json`,
      JSON.stringify(dupExternalIds, null, 2)
    );
    console.log(
      `This script doesn't support duplicate externalIds. Please fix them before running again.`
    );
    return;
  }

  if (dryRun) {
    console.log(`Dry run complete. No patients were updated.`);
    return;
  }

  await displayWarningAndConfirmation(orgName, localFacilityId);

  let page = 1;
  const loadStartedAt = Date.now();
  const patientsFromDb: PatientDTO[] = [];
  const { meta, patients } = await metriportAPI.listPatients({
    facilityId: localFacilityId,
    pagination: { count: 200 },
  });
  patientsFromDb.push(...patients);
  let nextPage = meta.nextPage;
  while (nextPage) {
    const nextPageViaLb = (new URL(nextPage).pathname + new URL(nextPage).search).replace(
      "/medical/v1",
      ""
    );
    console.log(`Getting nextPage (${++page}): ${nextPageViaLb}`);
    const { meta, patients } = await metriportAPI.listPatientsPage(nextPageViaLb);
    patientsFromDb.push(...patients);
    nextPage = meta.nextPage;
  }
  console.log(
    `${patientsFromDb.length} patients loaded in ${--page} pages, ${elapsedTimeAsStr(
      loadStartedAt
    )}`
  );

  console.log(`Matching...`);
  // Find matches between CSV patients and existing DB patients
  const matches: Array<{ csvPatient: PatientCreate; dbPatient: PatientDTO }> = [];
  const noMatches: PatientCreate[] = [];
  const multipleMatches: Array<{ csvPatient: PatientCreate; dbPatients: PatientDTO[] }> = [];

  for (const csvPatient of uniquePatients) {
    const matchingPatients = patientsFromDb.filter(dbPatient => {
      const sameFirstName =
        csvPatient.firstName.toLowerCase() === dbPatient.firstName.toLowerCase();
      const sameLastName = csvPatient.lastName.toLowerCase() === dbPatient.lastName.toLowerCase();
      const sameDob = csvPatient.dob === dbPatient.dob;
      const sameGender = csvPatient.genderAtBirth === dbPatient.genderAtBirth;
      return sameFirstName && sameLastName && sameDob && sameGender;
    });

    if (matchingPatients.length === 0) {
      noMatches.push(csvPatient);
    } else if (matchingPatients.length === 1) {
      matches.push({ csvPatient, dbPatient: matchingPatients[0] });
    } else {
      multipleMatches.push({ csvPatient, dbPatients: matchingPatients });
    }
  }

  // Store results in output folder
  fs.writeFileSync(`${outputFolderName}/matches.json`, JSON.stringify(matches, null, 2));
  fs.writeFileSync(`${outputFolderName}/no-matches.json`, JSON.stringify(noMatches, null, 2));
  fs.writeFileSync(
    `${outputFolderName}/no-matches.csv`,
    patientCreatesToCsv(noMatches, patientsFromCsv)
  );
  fs.writeFileSync(
    `${outputFolderName}/multiple-matches.json`,
    JSON.stringify(multipleMatches, null, 2)
  );

  console.log(`Found:
     ${matches.length} exact matches
     ${noMatches.length} patients with no matches
     ${multipleMatches.length} patients with multiple matches`);

  const patientUpdateSql: string[] = [];
  for (const match of matches) {
    patientUpdateSql.push(
      `UPDATE patient SET external_id = '${match.csvPatient.externalId}' WHERE id = '${match.dbPatient.id}' and cx_id = '${cxId}';`
    );
  }
  fs.writeFileSync(`${outputFolderName}/patient-update.sql`, patientUpdateSql.join("\n"));
}

function patientCreatesToCsv(
  patientCreates: PatientCreate[],
  patientsFromCsv: { raw: string[]; create: PatientCreate }[]
): string {
  return patientCreates
    .map(pc => {
      // TODO support doing this when there's no externalId
      const csvPatient = patientsFromCsv.find(p => p.create.externalId === pc.externalId);
      return csvPatient?.raw ?? [];
    })
    .join("\n");
}

function findDuplicateExternalIds(patientCreates: PatientCreate[]): string[] {
  const externalIds = patientCreates.flatMap(p => p.externalId ?? []);
  const acc = externalIds.reduce((acc, id) => {
    if (acc[id]) {
      acc[id]++;
    } else {
      acc[id] = 1;
    }
    return acc;
  }, {} as Record<string, number>);
  return Object.keys(acc).filter(id => acc[id] > 1);
}

async function displayWarningAndConfirmation(orgName: string, localFacilityId: string) {
  console.log(
    `Reading all patients at org/cx ${orgName}, facility ${localFacilityId}, in ${confirmationTime.asSeconds()} seconds...`
  );
  await sleep(confirmationTime.asMilliseconds());
  console.log(`running...`);
}

if (require.main === module) {
  main();
}
