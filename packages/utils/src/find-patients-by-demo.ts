import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import {
  Address,
  Contact,
  MetriportMedicalApi,
  PatientCreate,
  PatientDTO,
} from "@metriport/api-sdk";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { sleep } from "@metriport/core/util/sleep";
import {
  getEnvVar,
  isEmailValid,
  isPhoneValid,
  normalizeDate,
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
  console.log(`############## Started at ${new Date(startedAt).toISOString()} ##############`);

  initRunsFolder();
  program.parse();
  const { dryrun: dryRunParam } = program.opts<Params>();
  const dryRun = dryRunParam ?? false;

  const { orgName, facilityId: localFacilityId } = await getCxData(cxId, facilityId.trim());
  if (!localFacilityId) throw new Error("No facility found");
  const outputFolderName = getFolderName(orgName);

  initPatientIdRepository(outputFolderName);

  // This will insert all the patients into a specific facility.
  // Based off the apiKey it will determine the cx to add to the patients.
  const patientsFromCsv: PatientCreate[] = [];
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
      const result = mapCSVPatientToMetriportPatient(data);
      if (Array.isArray(result)) {
        mappingErrors.push({
          row: JSON.stringify(data),
          errors: result.map(e => e.error).join("; "),
        });
      } else {
        patientsFromCsv.push(result);
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
  patientsFromCsv: PatientCreate[],
  orgName: string,
  localFacilityId: string,
  outputFolderName: string,
  dryRun: boolean
) {
  console.log(`Loaded ${patientsFromCsv.length} patients from the CSV, deduplicating them...`);
  const dedupedPatients = dedupPatientCreates(patientsFromCsv);

  const msg = `${dedupedPatients.length} unique patients from the CSV file to be searched on/updated at org/cx ${orgName}`;
  console.log(msg);

  storePatientCreates(dedupedPatients, outputFolderName + "/patients-from-csv.json");

  await displayWarningAndConfirmation(orgName, localFacilityId, dryRun);

  const patientsFromTheDb = await metriportAPI.listPatients(localFacilityId);

  // Find matches between CSV patients and existing DB patients
  const matches: Array<{ csvPatient: PatientCreate; dbPatient: PatientDTO }> = [];
  const noMatches: PatientCreate[] = [];
  const multipleMatches: Array<{ csvPatient: PatientCreate; dbPatients: PatientDTO[] }> = [];

  for (const csvPatient of dedupedPatients) {
    const matchingPatients = patientsFromTheDb.filter(dbPatient => {
      const sameFirstName =
        csvPatient.firstName.toLowerCase() === dbPatient.firstName.toLowerCase();
      const sameLastName = csvPatient.lastName.toLowerCase() === dbPatient.lastName.toLowerCase();
      const sameDOB = csvPatient.dob === dbPatient.dob;
      const sameGender = csvPatient.genderAtBirth === dbPatient.genderAtBirth;
      return sameFirstName && sameLastName && sameDOB && sameGender;
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

function dedupPatientCreates(patients: PatientCreate[]): PatientCreate[] {
  const patientMap = new Map<string, PatientCreate>();
  patients.forEach(patient => {
    const nameKey = `${patient.firstName} ${patient.lastName}`;
    const existing = patientMap.get(nameKey);
    if (existing) {
      const mergedPatient = mergePatients(existing, patient);
      patientMap.set(nameKey, mergedPatient);
    } else {
      patientMap.set(nameKey, patient);
    }
  });
  return Array.from(patientMap.values());
}

function mergePatients(p1: PatientCreate, p2: PatientCreate): PatientCreate {
  const addresses = [
    ...(Array.isArray(p1.address) ? p1.address : [p1.address]),
    ...(Array.isArray(p2.address) ? p2.address : [p2.address]),
  ];
  const uniqueAddresses = deduplicateAddresses(addresses);

  const contacts = [
    ...(Array.isArray(p1.contact) ? p1.contact : p1.contact ? [p1.contact] : []),
    ...(Array.isArray(p2.contact) ? p2.contact : p2.contact ? [p2.contact] : []),
  ];
  const uniqueContacts = deduplicateContacts(contacts);

  return {
    ...p1,
    address: [uniqueAddresses[0], ...uniqueAddresses.slice(1)],
    contact: uniqueContacts,
  };
}

function deduplicateAddresses(addresses: Address[]): Address[] {
  const uniqueMap = new Map<string, Address>();

  addresses.forEach(addr => {
    const key = `${addr.addressLine1}|${addr.addressLine2 ?? ""}|${addr.city}|${addr.state}|${
      addr.zip
    }`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, addr);
    }
  });

  return Array.from(uniqueMap.values());
}

function deduplicateContacts(contacts: Contact[]): Contact[] {
  // Split contacts into separate phone and email arrays
  const phones = contacts.filter(c => c.phone).map(c => ({ phone: c.phone }));
  const emails = contacts.filter(c => c.email).map(c => ({ email: c.email }));
  // Deduplicate phones and emails separately
  const uniquePhones = Array.from(new Set(phones.map(p => p.phone))).map(phone => ({ phone }));
  const uniqueEmails = Array.from(new Set(emails.map(e => e.email))).map(email => ({ email }));
  // Merge phones and emails into combined contacts, matching by array position
  const maxLength = Math.max(uniquePhones.length, uniqueEmails.length);
  const deduplicatedContacts = Array.from({ length: maxLength }, (_, i) => ({
    ...(uniquePhones[i] ?? {}),
    ...(uniqueEmails[i] ?? {}),
  }));
  return deduplicatedContacts;
}

async function displayWarningAndConfirmation(
  orgName: string,
  localFacilityId: string,
  dryRun: boolean
) {
  if (!dryRun) logNotDryRun();
  console.log(
    `Reading all patients at org/cx ${orgName}, facility ${localFacilityId}, in ${confirmationTime.asSeconds()} seconds...`
  );
  await sleep(confirmationTime.asMilliseconds());
  console.log(`running...`);
}

function initPatientIdRepository(folderName: string) {
  if (!fs.existsSync(folderName)) {
    fs.mkdirSync(folderName, { recursive: true });
  }
}

function storePatientCreates(patientCreate: PatientCreate[], fileName: string) {
  fs.appendFileSync(fileName, JSON.stringify(patientCreate, null, 2));
}

function normalizeName(name: string | undefined, propName: string): string {
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

function normalizeCity(city: string | undefined): string {
  if (city == undefined) throw new Error(`Missing city`);
  return toTitleCase(city);
}

function normalizePhoneNumberUtils(phone: string | undefined): string | undefined {
  if (phone == undefined) return undefined;
  const normalPhone = normalizePhoneNumber(phone);
  if (normalPhone.length === 0) return undefined;
  if (!isPhoneValid(normalPhone)) throw new Error("Invalid Phone");
  return normalPhone;
}

function normalizeEmailUtils(email: string | undefined): string | undefined {
  if (email == undefined) return undefined;
  const normalEmail = normalizeEmail(email);
  if (normalEmail.length === 0) return undefined;
  if (!isEmailValid(normalEmail)) throw new Error("Invalid Email");
  return normalEmail;
}

function normalizeExternalIdUtils(id: string | undefined): string | undefined {
  if (id == undefined) return undefined;
  const normalId = normalizeExternalId(id);
  if (normalId.length === 0) return undefined;
  return normalId;
}

export function mapCSVPatientToMetriportPatient(csvPatient: {
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
    dob = normalizeDate(csvPatient.dob ?? "");
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
