import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Address, Contact, MetriportMedicalApi, PatientCreate } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { errorToString } from "@metriport/core/util/error/shared";
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
  normalizeZipCode,
  toTitleCase,
} from "@metriport/shared";
import { Command } from "commander";
import csv from "csv-parser";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
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

// Full path to the file
const inputFileName = "";

const apiKey = getEnvVarOrFail("API_KEY");
const apiUrl = getEnvVarOrFail("API_URL");
const cxId = getEnvVarOrFail("CX_ID");
const facilityId = getEnvVar("FACILITY_ID") ?? "";
const delayTime = dayjs.duration(5, "seconds").asMilliseconds();
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
  const results: PatientCreate[] = [];
  const fileName = inputFileName;
  fs.createReadStream(fileName)
    .pipe(csv({ mapHeaders: ({ header }) => header.replaceAll(" ", "").replaceAll("*", "") }))
    .on("data", async data => {
      const metriportPatient = mapCSVPatientToMetriportPatient(data);
      if (metriportPatient) results.push(metriportPatient);
    })
    .on("end", async () => loadData(results, orgName, localFacilityId, outputFolderName, dryRun));
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
      storePatientId(createdPatient.id, outputFolderName + "/ids.txt");
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

function initPatientIdRepository(folderName: string) {
  if (!fs.existsSync(folderName)) {
    fs.mkdirSync(folderName, { recursive: true });
  }
}

function storePatientCreates(patientCreate: PatientCreate[], fileName: string) {
  fs.appendFileSync(fileName, JSON.stringify(patientCreate, null, 2));
}
function storePatientId(patientId: string, fileName: string) {
  fs.appendFileSync(fileName, patientId + "\n");
}

function normalizeName(name: string | undefined, propName: string): string {
  if (name == undefined) throw new Error(`Missing ` + propName);
  return toTitleCase(name);
}

function normalizeAddressLine(addressLine: string | undefined, propName: string): string {
  if (addressLine == undefined) throw new Error(`Missing ` + propName);
  return toTitleCase(addressLine);
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

const mapCSVPatientToMetriportPatient = (csvPatient: {
  firstname: string | undefined;
  lastname: string | undefined;
  dob: string | undefined;
  gender: string | undefined;
  zip: string | undefined;
  city: string | undefined;
  state: string | undefined;
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
}): PatientCreate | undefined => {
  const phone1 = normalizePhoneNumberUtils(csvPatient.phone ?? csvPatient.phone1);
  const email1 = normalizeEmailUtils(csvPatient.email ?? csvPatient.email1);
  const phone2 = normalizePhoneNumberUtils(csvPatient.phone2);
  const email2 = normalizeEmailUtils(csvPatient.email2);
  const contact1 = phone1 || email1 ? { phone: phone1, email: email1 } : undefined;
  const contact2 = phone2 || email2 ? { phone: phone2, email: email2 } : undefined;
  const contact = [contact1, contact2].flatMap(c => c ?? []);
  const externalId = csvPatient.id
    ? normalizeExternalIdUtils(csvPatient.id)
    : normalizeExternalIdUtils(csvPatient.externalId) ?? undefined;
  return {
    externalId,
    firstName: normalizeName(csvPatient.firstname, "firstname"),
    lastName: normalizeName(csvPatient.lastname, "lastname"),
    dob: normalizeDate(csvPatient.dob ?? ""),
    genderAtBirth: normalizeGender(csvPatient.gender ?? ""),
    address: {
      addressLine1: normalizeAddressLine(
        csvPatient.address1 ?? csvPatient.addressLine1,
        "address1 | addressLine1"
      ),
      addressLine2: normalizeAddressLine(
        csvPatient.address2 ?? csvPatient.addressLine2,
        "address2 | addressLine2"
      ),
      city: normalizeCity(csvPatient.city),
      state: normalizeUSStateForAddress(csvPatient.state ?? ""),
      zip: normalizeZipCode(csvPatient.zip ?? ""),
      country: "USA",
    },
    contact,
  };
};

main();
