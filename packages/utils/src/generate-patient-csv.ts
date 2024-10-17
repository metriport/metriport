import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import fs from "fs";
import { PatientData } from "@metriport/core/domain/patient";
import { makePatientData } from "@metriport/core/domain/__tests__/patient";

const numberOfPatient = 10;
const fileName = "bulk-patient-import.csv";

export const PatientImportCsvHeaders = [
  "externalid",
  "firstname",
  "lastname",
  "dob",
  "gender",
  "zip",
  "city",
  "state",
  "addressline1",
  "addressline2",
  "phone1",
  "email1",
  "phone2",
  "email2",
];

function createPatientRow(patient: PatientData): string {
  const address = patient.address[0];
  const contact = patient.contact?.[0];
  const contact2 = patient.contact?.[1];
  return [
    "",
    patient.firstName,
    patient.lastName,
    patient.dob,
    patient.genderAtBirth,
    address.zip,
    address.city,
    address.state,
    address.addressLine1,
    address.addressLine2 ?? "",
    contact ? contact.phone : "",
    contact ? contact.email : "",
    contact2 ? contact2.phone : "",
    contact2 ? contact2.email : "",
  ].join(",");
}

async function main() {
  const patients = [];
  for (let i = 0; i < numberOfPatient; i++) {
    patients.push(makePatientData());
  }

  const headers = PatientImportCsvHeaders;

  const patientRows = patients.map(createPatientRow);
  const file = fs.createWriteStream(fileName);
  file.write([headers, ...patientRows].join("\n"));
  file.close();
}

main();
