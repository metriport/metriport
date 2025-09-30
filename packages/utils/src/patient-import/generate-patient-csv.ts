import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { faker } from "@faker-js/faker";
import { validateAndParsePatientImportCsv } from "@metriport/core/command/patient-import/csv/validate-and-parse-import";
import {
  isParsedPatientError,
  isParsedPatientSuccess,
  PatientPayload,
} from "@metriport/core/command/patient-import/patient-import";
import { Address } from "@metriport/core/domain/address";
import { Contact } from "@metriport/core/domain/contact";
import { DriversLicense, PersonalIdentifier } from "@metriport/core/domain/patient";
import { makeAddressStrict } from "@metriport/core/domain/__tests__/location-address";
import {
  makePatientData,
  makePersonalIdentifierDriversLicense,
  makePersonalIdentifierSsn,
} from "@metriport/core/domain/__tests__/patient";
import { sleep } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { filterTruthy } from "@metriport/shared/common/filter-map";
import fs from "fs";
import { elapsedTimeAsStr } from "../shared/duration";
import { makeDir } from "../shared/fs";
import { invalidToString, patientCreationToString, validToString } from "./shared";

/**
 * Creates a mock CSV file with patient data for bulk import.
 *
 * The output files will be created in the `runs/bulk-import-mock` folder, under the current
 * timestamp.
 *
 * Also, a file named `current-raw.csv` will be created in the `runs/bulk-import-mock` folder,
 * so the terminal can display a link so that we can open the file with a "cmd+click" on its name.
 *
 * Usage:
 * - update the constants below
 * - run it with `npm run generate-patient-csv`
 * - the file will be created in the `runs/bulk-import-mock` folder
 * - optionally, pass the number of patients as an argument
 *   - `npm run generate-patient-csv 1000`
 *   - `npm run generate-patient-csv 10000`
 *   - `npm run generate-patient-csv 100000`
 */

// The amount of patients to generate
const numberOfPatients = process.argv[2] ? parseInt(process.argv[2]) : 100;

// The percentage of patients that will have each property:
const percentageWithExternalId = 0.5;
const percentageWithAddressLine2 = 0.4;
const percentageWithSsn = 0.1;
const percentageWithDriversLicence = 0.2;
const potentialCohorts = [["High Risk"], ["Low Risk", "Custom Cohort"], []];
function getAmountOfAddresses() {
  return faker.number.int({ min: 1, max: 10 });
}
function getAmountOfContacts() {
  return faker.number.int({ min: 0, max: 10 });
}

// The order inside each of those matters!
const mainHeaders = "externalId,firstName,lastName,dob,gender";
const addressHeaders = "zip,city,state,addressLine1,addressLine2";
const contactHeaders = "phone,email";
const additionalIdentifiersHeaders = "ssn,driversLicenceNo,driversLicenceState";
const cohortsHeaders = "cohort1,cohort2";

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  console.log(`############## Started at ${new Date(startedAt).toISOString()} ##############`);

  const timestamp = buildDayjs().toISOString();
  const outputBaseFolder = `runs/bulk-import-mock`;
  const outputFolderName = `${outputBaseFolder}/${timestamp}`;
  makeDir(outputFolderName);
  const outputFileName = `raw.csv`;
  const outputFileNameFull = `./${outputFolderName}/${outputFileName}`;
  const outputCurrentFileNameFull = `./${outputBaseFolder}/current-raw.csv`;

  const patients: PatientPayload[] = [];
  for (let i = 0; i < numberOfPatients; i++) {
    const patientData = makePatient();
    patients.push(patientData);
  }
  const { headers, amountOfAddresses, amountOfContacts } = buildHeaders(patients);
  const contents = patients.map(patientToCsv(amountOfAddresses, amountOfContacts)).join("\n");
  const fileContents = [headers, contents].join("\n");
  fs.writeFileSync(outputFileNameFull, fileContents);
  fs.rmSync(outputCurrentFileNameFull, { force: true });
  fs.writeFileSync(outputCurrentFileNameFull, fileContents);

  const { patients: patientsFromValidation } = await validateAndParsePatientImportCsv({
    contents: fileContents,
  });

  const validRows = patientsFromValidation.filter(isParsedPatientSuccess).map(validToString);
  const invalidRows = patientsFromValidation.filter(isParsedPatientError).map(invalidToString);
  const patientsForCreate: PatientPayload[] = patientsFromValidation
    .filter(isParsedPatientSuccess)
    .map(p => p.parsed);

  const outputValid = headers + "\n" + validRows.join("\n");
  const outputInvalid = headers + ",error" + "\n" + invalidRows.join("\n");
  const outputPatientsCreation = patientsForCreate.map(patientCreationToString).join("\n");

  fs.writeFileSync(`./${outputFolderName}/valid.csv`, outputValid);
  fs.writeFileSync(`./${outputFolderName}/invalid.csv`, outputInvalid);
  fs.writeFileSync(`./${outputFolderName}/creation.ndjson`, outputPatientsCreation);

  console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
  // Easier to cmd+click and open the file from the terminal
  console.log(`>>> File: "${outputCurrentFileNameFull}"`);
}

function makePatient(): PatientPayload {
  const patientData = makePatientData();

  const externalId = faker.helpers.maybe(() => faker.string.uuid(), {
    probability: percentageWithExternalId,
  });

  const cohorts = faker.helpers.arrayElement(potentialCohorts);

  const amountOfContacts = getAmountOfContacts();
  const amountOfAddresses = getAmountOfAddresses();
  const address = Array.from({ length: amountOfAddresses }, () => makeAddress());
  const contact = Array.from({ length: amountOfContacts }, () => makeContact());
  patientData.address = address;
  patientData.contact = contact;

  const ssn = faker.helpers.maybe(() => makePersonalIdentifierSsn(), {
    probability: percentageWithSsn,
  });
  const driversLicense = faker.helpers.maybe(() => makePersonalIdentifierDriversLicense(), {
    probability: percentageWithDriversLicence,
  });
  patientData.personalIdentifiers = [ssn, driversLicense].flatMap(filterTruthy);

  return {
    externalId,
    cohorts,
    ...patientData,
  };
}

function makeAddress(): Address {
  const addressLine2 = faker.helpers.maybe(() => faker.location.secondaryAddress(), {
    probability: percentageWithAddressLine2,
  });
  return makeAddressStrict({ addressLine2 });
}

export function makeContact(): Contact {
  const email = faker.helpers.maybe(() => faker.internet.email());
  const phone = email ? faker.helpers.maybe(() => faker.phone.number()) : faker.phone.number();
  return { email, phone };
}

function buildHeaders(patients: PatientPayload[]): {
  headers: string;
  amountOfAddresses: number;
  amountOfContacts: number;
} {
  let maxAmountOfContacts = 0;
  let maxAmountOfAddresses = 0;
  patients.forEach(patient => {
    maxAmountOfContacts = Math.max(maxAmountOfContacts, patient.contact?.length ?? 0);
    maxAmountOfAddresses = Math.max(maxAmountOfAddresses, patient.address?.length ?? 0);
  });
  const headers = [mainHeaders];
  for (let i = 1; i <= maxAmountOfAddresses; i++) {
    headers.push(buildHeadersForVariableColumns(addressHeaders, i));
  }
  for (let i = 1; i <= maxAmountOfContacts; i++) {
    headers.push(buildHeadersForVariableColumns(contactHeaders, i));
  }
  headers.push(additionalIdentifiersHeaders);
  headers.push(cohortsHeaders);
  return {
    headers: headers.join(","),
    amountOfAddresses: maxAmountOfAddresses,
    amountOfContacts: maxAmountOfContacts,
  };
}

function buildHeadersForVariableColumns(headers: string, columnNumber: number) {
  return headers
    .split(",")
    .map(header => `${header}-${columnNumber}`)
    .join(",");
}

function patientToCsv(amountOfAddresses: number, amountOfContacts: number) {
  return (patient: PatientPayload): string => {
    const columns: string[] = [];
    columns.push(patient.externalId ?? "");
    columns.push(patient.firstName);
    columns.push(patient.lastName);
    columns.push(patient.dob);
    columns.push(patient.genderAtBirth);
    for (let i = 0; i < amountOfAddresses; i++) {
      columns.push(addressToCsv(patient.address?.[i] ?? {}));
    }
    for (let i = 0; i < amountOfContacts; i++) {
      columns.push(contactToCsv(patient.contact?.[i] ?? {}));
    }
    columns.push(personalIdsToCsv(patient.personalIdentifiers ?? []));
    for (let i = 0; i < patient.cohorts?.length; i++) {
      columns.push(normalizeCohortName(patient.cohorts?.[i]));
    }
    return columns.join(",");
  };
}

function addressToCsv(address: Partial<Address>): string {
  const columns: string[] = [];
  columns.push(address.zip ?? "");
  columns.push(address.city ?? "");
  columns.push(address.state ?? "");
  columns.push(address.addressLine1 ?? "");
  columns.push(address.addressLine2 ?? "");
  return columns.join(",");
}

function contactToCsv(contact: Contact): string {
  const columns: string[] = [];
  columns.push(contact.phone ?? "");
  columns.push(contact.email ?? "");
  return columns.join(",");
}

function normalizeCohortName(cohortName: string): string {
  return cohortName.trim().toUpperCase();
}

function personalIdsToCsv(identifiers: PersonalIdentifier[]): string {
  const ssn = identifiers.find(identifier => identifier.type === "ssn");
  const driversLicense = identifiers.find(
    (id: PersonalIdentifier): id is DriversLicense => id.type === "driversLicense"
  );
  const columns: string[] = [];
  columns.push(ssn?.value ?? "");
  columns.push(driversLicense?.value ?? "");
  columns.push(driversLicense?.state ?? "");
  return columns.join(",");
}

main();
