import * as dotenv from "dotenv";
dotenv.config();

import { MetriportMedicalApi, PatientCreate, USState } from "@metriport/api";
import csv from "csv-parser";
import fs from "fs";

const apiKey = getEnvVarOrFail("API_KEY");
const facilityId = getEnvVarOrFail("FACILITY_ID");
const apiUrl = getEnvVarOrFail("API_URL");
const delayTime = 3000;

const metriportAPI = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
});

async function main() {
  const results: PatientCreate[] = [];
  const errors: Array<{ firstName: string; lastName: string; dob: string; message: string }> = [];

  // This will insert all the patients into a specific facility.
  // Based off the apiKey it will determine the cx to add to the patients.
  fs.createReadStream("../insert-patients.csv")
    .pipe(csv())
    .on("data", async data => {
      const metriportPatient = mapCSVPatientToMetriportPatient(data);

      if (metriportPatient) {
        results.push(metriportPatient);
      }
    })
    .on("end", async () => {
      for (const [i, patient] of results.entries()) {
        try {
          await sleep(delayTime);
          const createdPatient = await metriportAPI.createPatient(patient, facilityId);
          console.log(i, createdPatient);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
          errors.push({
            firstName: patient.firstName,
            lastName: patient.lastName,
            dob: patient.dob,
            message: error.message,
          });
        }
      }
      console.log(errors);
    });
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const mapCSVPatientToMetriportPatient = (csvPatient: {
  firstname: string;
  lastname: string;
  patient_dob: string;
  address1: string;
  city: string;
  state_name: string;
  zipcode: string;
  phone: string;
  gender: string;
}): PatientCreate | undefined => {
  const validGender = csvPatient.gender === "Male" || csvPatient.gender === "Female";

  if (!validGender) {
    console.log("Invalid gender provided for patient: ", csvPatient);
    return;
  }

  return {
    firstName: csvPatient.firstname,
    lastName: csvPatient.lastname,
    dob: csvPatient.patient_dob,
    genderAtBirth: csvPatient.gender === "Female" ? "F" : "M",
    address: {
      ...(csvPatient.address1 ? { addressLine1: csvPatient.address1 } : {}),
      ...(csvPatient.city ? { city: csvPatient.city } : {}),
      ...(csvPatient.state_name ? { state: states[csvPatient.state_name] } : {}),
      zip: csvPatient.zipcode,
      country: "USA",
    },
    personalIdentifiers: [],
    ...(csvPatient.phone ? { contact: { phone: csvPatient.phone } } : {}),
  };
};

function getEnvVar(varName: string): string | undefined {
  return process.env[varName];
}
function getEnvVarOrFail(varName: string): string {
  const value = getEnvVar(varName);
  if (!value || value.trim().length < 1) {
    throw new Error(`Missing ${varName} env var`);
  }
  return value;
}

main();

const states: { [k in string]: USState } = {
  Arizona: USState.AZ,
  Alabama: USState.AL,
  Alaska: USState.AK,
  Arkansas: USState.AR,
  California: USState.CA,
  Colorado: USState.CO,
  Connecticut: USState.CT,
  Delaware: USState.DE,
  Florida: USState.FL,
  Georgia: USState.GA,
  Hawaii: USState.HI,
  Idaho: USState.ID,
  Illinois: USState.IL,
  Indiana: USState.IN,
  Iowa: USState.IA,
  Kansas: USState.KS,
  Kentucky: USState.KY,
  Louisiana: USState.LA,
  Maine: USState.ME,
  Maryland: USState.MD,
  Massachusetts: USState.MA,
  Michigan: USState.MI,
  Minnesota: USState.MN,
  Mississippi: USState.MS,
  Missouri: USState.MO,
  Montana: USState.MT,
  Nebraska: USState.NE,
  Nevada: USState.NV,
  "New Hampshire": USState.NH,
  "New Jersey": USState.NJ,
  "New Mexico": USState.NM,
  "New York": USState.NY,
  "North Carolina": USState.NC,
  "North Dakota": USState.ND,
  Ohio: USState.OH,
  Oklahoma: USState.OK,
  Oregon: USState.OR,
  Pennsylvania: USState.PA,
  "Rhode Island": USState.RI,
  "South Carolina": USState.SC,
  "South Dakota": USState.SD,
  Tennessee: USState.TN,
  Texas: USState.TX,
  Utah: USState.UT,
  Vermont: USState.VT,
  Virginia: USState.VA,
  Washington: USState.WA,
  "West Virginia": USState.WV,
  Wisconsin: USState.WI,
  Wyoming: USState.WY,
};
