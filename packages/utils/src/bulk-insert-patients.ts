import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { MetriportMedicalApi, PatientCreate } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { errorToString } from "@metriport/core/util/error/shared";
import { sleep } from "@metriport/core/util/sleep";
import {
  getEnvVar,
  isEmailValid,
  isPhoneValid,
  normalizeDob,
  normalizeEmail,
  normalizeExternalId,
  normalizeGender,
  normalizePhoneNumber,
  normalizeUSStateForAddress,
  normalizeZipCodeNew,
  toTitleCase,
  USStateForAddress,
} from "@metriport/shared";
import { filterTruthy } from "@metriport/shared/common/filter-map";
import { Command } from "commander";
import csv from "csv-parser";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { elapsedTimeAsStr } from "./shared/duration";
import { buildGetDirPathInside, initRunsFolder } from "./shared/folder";
import { getCxData } from "./shared/get-cx-data";
import { logNotDryRun } from "./shared/log";
import { dedupPatientCreates, storePatientCreates } from "./shared/patient-create";

dayjs.extend(duration);

/**
 * This script will read patients from a .csv file and insert them into the Metriport API.
 *
 * It outputs the result of processing in the ./runs/bulk-insert/<cx-date>/ folder.
 * - ids.csv: contains the list of patient ids and external ids
 * - patient-creates.json: contains the list of patients that would be created (when run w/ dryrun)
 * - mapping-errors.json: contains the list of errors found in the CSV file
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

// Full path to the file
const inputFileName = "";

const delayTime = dayjs.duration(5, "seconds").asMilliseconds();

const apiKey = getEnvVarOrFail("API_KEY");
const apiUrl = getEnvVarOrFail("API_URL");
const cxId = getEnvVarOrFail("CX_ID");
const facilityIdEnvVar = getEnvVar("FACILITY_ID");
const facilityId =
  facilityIdEnvVar && facilityIdEnvVar.trim().length > 1 ? facilityIdEnvVar?.trim() : undefined;
const confirmationTime = dayjs.duration(10, "seconds");

const getFolderName = buildGetDirPathInside(`bulk-insert`);

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

  const { orgName, facilityId: localFacilityId } = await getCxData(cxId, facilityId);
  if (!localFacilityId) throw new Error("No facility found");
  const outputFolderName = getFolderName(orgName);

  initPatientIdRepository(outputFolderName);

  // This will insert all the patients into a specific facility.
  // Based off the apiKey it will determine the cx to add to the patients.
  const results: PatientCreate[] = [];
  const mappingErrors: Array<{ row: string; errors: string }> = [];
  const fileName = inputFileName;

  fs.createReadStream(fileName)
    .pipe(
      csv({
        mapHeaders: ({ header }: { header: string }) => {
          return header.replace(/[!@#$%^&*()+=\-[\]\\';,./{}|":<>?~_\s]/gi, "").toLowerCase();
        },
      })
    )
    .on("data", async data => {
      const result = mapCsvPatientToMetriportPatient(data);
      if (Array.isArray(result)) {
        mappingErrors.push({
          row: JSON.stringify(data),
          errors: result.map(e => e.error).join("; "),
        });
      } else {
        results.push(result);
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
      await loadData(results, orgName, localFacilityId, outputFolderName, dryRun);
      console.log(`>>>>>>> Done after ${elapsedTimeAsStr(startedAt)}`);
    });
}

async function loadData(
  results: PatientCreate[],
  orgName: string,
  localFacilityId: string,
  outputFolderName: string,
  dryRun: boolean
) {
  console.log(`Loaded ${results.length} patients from the CSV, deduplicating them...`);
  const patientsCreates = dedupPatientCreates(results);

  const msg = `${patientsCreates.length} unique patients from the CSV file to be inserted at org/cx ${orgName}`;
  console.log(msg);

  const storePatientId = buildStorePatientId(outputFolderName);
  storePatientCreates(patientsCreates, outputFolderName + "/patient-creates.json");

  if (dryRun) {
    console.log("Dry run, not inserting patients.");
    console.log(`List of patients: ${JSON.stringify(patientsCreates, null, 2)}`);
    console.log(msg);
    console.log("Done.");
    return;
  }
  await displayWarningAndConfirmation(patientsCreates.length, orgName, dryRun);
  let successfulCount = 0;
  const errors: Array<{ firstName: string; lastName: string; dob: string; message: string }> = [];

  for (const [i, patient] of patientsCreates.entries()) {
    try {
      const createdPatient = await metriportAPI.createPatient(patient, localFacilityId, {
        rerunPdOnNewDemographics: true,
      });
      successfulCount++;
      console.log(i + 1, createdPatient);
      storePatientId(createdPatient.id, createdPatient.externalId);
      if (i < patientsCreates.length - 1) await sleep(delayTime);
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

async function displayWarningAndConfirmation(
  patientCount: number,
  orgName: string,
  dryRun: boolean
) {
  if (!dryRun) logNotDryRun();
  console.log(
    `Inserting ${patientCount} patients at org/cx ${orgName} in ${confirmationTime.asSeconds()} seconds...`
  );
  await sleep(confirmationTime.asMilliseconds());
  console.log(`running...`);
}

export function initPatientIdRepository(folderName: string) {
  if (!fs.existsSync(folderName)) {
    fs.mkdirSync(folderName, { recursive: true });
  }
}

function buildStorePatientId(outputFolderName: string) {
  const idsFileName = outputFolderName + "/ids.csv";
  const header = "patientId,externalId";
  fs.appendFileSync(idsFileName, header + "\n");
  return (patientId: string, externalId: string | undefined) => {
    const record = `${patientId},${externalId ?? ""}`;
    fs.appendFileSync(idsFileName, record + "\n");
  };
}

export function normalizeName(name: string | undefined, propName: string): string {
  if (name == undefined) throw new Error(`Missing ` + propName);
  return toTitleCase(name);
}

export function normalizeAddressLine(
  addressLine: string | undefined,
  propName: string,
  splitUnit: true
): string[];
export function normalizeAddressLine(
  addressLine: string | undefined,
  propName: string,
  splitUnit?: false | undefined
): string;
export function normalizeAddressLine(
  addressLine: string | undefined,
  propName: string,
  splitUnit = false
): string | string[] {
  if (addressLine == undefined) throw new Error(`Missing ` + propName);
  const withoutPunctuation = addressLine.replace(/[.,;]/g, " ");
  const withoutInstructions = withoutPunctuation.replace(/\(.*\)/g, " ");
  const normalized = toTitleCase(withoutInstructions);
  if (!splitUnit) return normalized;
  // Common street type variations in US addresses
  const match = (normalized + " ").match(pattern);
  if (match && match.flatMap(filterTruthy).length > 3) {
    const [, mainAddressMatch, , unitMatch] = match;
    const mainAddress = mainAddressMatch ? mainAddressMatch.trim() : undefined;
    const unit = unitMatch ? unitMatch.trim() : undefined;
    return [mainAddress, unit].flatMap(filterTruthy);
  }
  const matchExact = normalized.match(patternExact);
  if (matchExact && matchExact.flatMap(filterTruthy).length > 2) {
    const [, mainAddressMatch, unitMatch] = matchExact;
    const mainAddress = mainAddressMatch ? mainAddressMatch.trim() : undefined;
    const unit = unitMatch ? unitMatch.trim() : undefined;
    return [mainAddress, unit].flatMap(filterTruthy);
  }
  return [normalized];
}

export function normalizeCity(city: string | undefined): string {
  if (city == undefined) throw new Error(`Missing city`);
  return toTitleCase(city);
}

export function normalizePhoneNumberUtils(phone: string | undefined): string | undefined {
  if (phone == undefined) return undefined;
  const normalPhone = normalizePhoneNumber(phone);
  if (normalPhone.length === 0) return undefined;
  if (!isPhoneValid(normalPhone)) throw new Error("Invalid Phone");
  return normalPhone;
}

export function normalizeEmailUtils(email: string | undefined): string | undefined {
  if (email == undefined) return undefined;
  const normalEmail = normalizeEmail(email);
  if (normalEmail.length === 0) return undefined;
  if (!isEmailValid(normalEmail)) throw new Error("Invalid Email");
  return normalEmail;
}

export function normalizeExternalIdUtils(id: string | undefined): string | undefined {
  if (id == undefined) return undefined;
  const normalId = normalizeExternalId(id);
  if (normalId.length === 0) return undefined;
  return normalId;
}

export function mapCsvPatientToMetriportPatient(csvPatient: {
  firstname: string | undefined;
  lastname: string | undefined;
  dob: string | undefined;
  gender: string | undefined;
  zip: string | undefined;
  city: string | undefined;
  state: string | undefined;
  address1: string | undefined;
  addressline1: string | undefined;
  address2: string | undefined;
  addressline2: string | undefined;
  phone: string | undefined;
  phone1: string | undefined;
  phone2: string | undefined;
  email: string | undefined;
  email1: string | undefined;
  email2: string | undefined;
  id: string | undefined;
  externalid: string | undefined;
}): PatientCreate | Array<{ field: string; error: string }> {
  const errors: Array<{ field: string; error: string }> = [];

  // Map and validate each field, collecting errors
  let firstName: string | undefined = undefined;
  try {
    firstName = normalizeName(csvPatient.firstname, "firstname");
    if (!firstName) throw new Error(`Missing firstName`);
  } catch (error) {
    errors.push({
      field: "firstName",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  let lastName: string | undefined = undefined;
  try {
    lastName = normalizeName(csvPatient.lastname, "lastname");
    if (!lastName) throw new Error(`Missing lastName`);
  } catch (error) {
    errors.push({
      field: "lastName",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  let dob: string | undefined = undefined;
  try {
    dob = normalizeDob(csvPatient.dob ?? "");
    if (!dob) throw new Error(`Missing dob`);
  } catch (error) {
    errors.push({ field: "dob", error: error instanceof Error ? error.message : String(error) });
  }

  let genderAtBirth: "M" | "F" | "O" | "U" | undefined = undefined;
  try {
    genderAtBirth = normalizeGender(csvPatient.gender ?? "") as "M" | "F" | "O" | "U";
    if (!genderAtBirth) throw new Error(`Missing gender`);
  } catch (error) {
    errors.push({ field: "gender", error: error instanceof Error ? error.message : String(error) });
  }

  let addressLine1: string | undefined = undefined;
  let addressLine2: string | undefined = undefined;
  try {
    const res = normalizeAddressLine(
      csvPatient.address1 ?? csvPatient.addressline1,
      "addressLine1",
      true
    );
    addressLine1 = res[0];
    addressLine2 = res[1];
    if (!addressLine1) throw new Error(`Missing addressLine1`);
  } catch (error) {
    errors.push({
      field: "addressLine1",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const res = normalizeAddressLine(
      csvPatient.address2 ?? csvPatient.addressline2,
      "addressLine2"
    );
    if (addressLine2 && res) {
      throw new Error(
        `Found addressLine2 on both its own field and as part of addressLine1 (from addressLine1: ${addressLine2})`
      );
    }
    if (!addressLine2) addressLine2 = res;
  } catch (error) {
    errors.push({
      field: "addressLine2",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  let city: string | undefined = undefined;
  try {
    city = normalizeCity(csvPatient.city);
    if (!city) throw new Error(`Missing city`);
  } catch (error) {
    errors.push({ field: "city", error: error instanceof Error ? error.message : String(error) });
  }

  let state: USStateForAddress | undefined = undefined;
  try {
    state = normalizeUSStateForAddress(csvPatient.state ?? "");
    if (!state) throw new Error(`Missing state`);
  } catch (error) {
    errors.push({ field: "state", error: error instanceof Error ? error.message : String(error) });
  }

  let zip: string | undefined = undefined;
  try {
    zip = normalizeZipCodeNew(csvPatient.zip ?? "");
    if (!zip) throw new Error(`Missing zip`);
  } catch (error) {
    errors.push({ field: "zip", error: error instanceof Error ? error.message : String(error) });
  }

  // Contact info validation
  let phone1: string | undefined = undefined;
  try {
    phone1 = normalizePhoneNumberUtils(csvPatient.phone ?? csvPatient.phone1);
  } catch (error) {
    errors.push({ field: "phone1", error: error instanceof Error ? error.message : String(error) });
  }

  let email1: string | undefined = undefined;
  try {
    email1 = normalizeEmailUtils(csvPatient.email ?? csvPatient.email1);
  } catch (error) {
    errors.push({ field: "email1", error: error instanceof Error ? error.message : String(error) });
  }

  let phone2: string | undefined = undefined;
  try {
    phone2 = normalizePhoneNumberUtils(csvPatient.phone2);
  } catch (error) {
    errors.push({ field: "phone2", error: error instanceof Error ? error.message : String(error) });
  }

  let email2: string | undefined = undefined;
  try {
    email2 = normalizeEmailUtils(csvPatient.email2);
  } catch (error) {
    errors.push({ field: "email2", error: error instanceof Error ? error.message : String(error) });
  }

  const contact1 = phone1 || email1 ? { phone: phone1, email: email1 } : undefined;
  const contact2 = phone2 || email2 ? { phone: phone2, email: email2 } : undefined;
  const contact = [contact1, contact2].flatMap(c => c ?? []);

  const externalId = csvPatient.id
    ? normalizeExternalIdUtils(csvPatient.id)
    : normalizeExternalIdUtils(csvPatient.externalid) ?? undefined;

  // Return errors if any were found
  if (errors.length > 0) {
    return errors;
  }

  // Verify all required fields are present
  if (
    !firstName ||
    !lastName ||
    !dob ||
    !genderAtBirth ||
    !addressLine1 ||
    !city ||
    !state ||
    !zip
  ) {
    return [{ field: "general", error: "Missing required fields" }];
  }

  // All validations passed, return patient object
  return {
    externalId,
    firstName,
    lastName,
    dob,
    genderAtBirth,
    address: {
      addressLine1,
      addressLine2,
      city,
      state,
      zip,
      country: "USA",
    },
    contact,
  };
}

const streetTypes = [
  "street",
  "st",
  "road",
  "rd",
  "lane",
  "ln",
  "drive",
  "dr",
  "avenue",
  "ave",
  "boulevard",
  "blvd",
  "circle",
  "cir",
  "court",
  "ct",
  "place",
  "pl",
  "terrace",
  "ter",
  "trail",
  "trl",
  "way",
  "highway",
  "hwy",
  "parkway",
  "pkwy",
  "crossing",
  "xing",
  "square",
  "sq",
  "loop",
  "path",
  "pike",
  "alley",
  "run",
];

const unitIndicators = ["apt", "apartment", "unit", "suite", "ste", "#", "number", "floor", "trlr"];
const unitIndicatorsExact = unitIndicators.concat(["no", "fl", "lot", "rm", "room"]);
const pattern = new RegExp(
  `(.*?\\W+(${streetTypes.join("|")})\\W+.*?)\\s*((${unitIndicators.join(
    "|"
  )})\\s*[#]?\\s*[\\w\\s-]+)?$`,
  "i"
);
const patternExact = new RegExp(
  `(.+?)\\s*((${unitIndicatorsExact.join("|")})((\\s*#\\s*[\\w\\s-]+)|(\\s*[\\d\\s-]+)))?$`,
  "i"
);

if (require.main === module) {
  main();
}
