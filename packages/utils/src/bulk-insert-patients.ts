import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { MetriportMedicalApi, PatientCreate, USState } from "@metriport/api-sdk";
import csv from "csv-parser";
import fs from "fs";
import { getEnvVar, getEnvVarOrFail } from "./shared/env";
import dayjs from "dayjs";
import path from "path";

const apiKey = getEnvVarOrFail("API_KEY");
const facilityId = getEnvVarOrFail("FACILITY_ID");
const apiUrl = getEnvVarOrFail("API_URL");
const delayTime = parseInt(getEnvVar("BULK_INSERT_DELAY_TIME") ?? "200");

const metriportAPI = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
});

async function main() {
  const results: PatientCreate[] = [];
  const errors: Array<{ firstName: string; lastName: string; dob: string; message: string }> = [];

  // This will insert all the patients into a specific facility.
  // Based off the apiKey it will determine the cx to add to the patients.
  fs.createReadStream(path.join(__dirname, "bulk-insert-patients.csv"))
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

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map(s => s.charAt(0).toUpperCase() + s.substring(1))
    .join(" ")
    .trim();
}

function normalizeGender(gender: string): "M" | "F" {
  const lowerGender = gender.toLowerCase().trim();
  if (lowerGender === "male" || lowerGender === "m") {
    return "M";
  } else if (lowerGender === "female" || lowerGender === "f") {
    return "F";
  }
  throw new Error(`Invalid gender ${gender}`);
}

function normalizeName(name: string): string {
  return toTitleCase(name);
}

function normalizePhone(phone: string): string {
  const trimmedPhone = phone.trim();
  if (trimmedPhone.length === 11 && trimmedPhone[0] === "1") {
    // removes leading country code 1s
    return trimmedPhone.substring(1);
  } else if (trimmedPhone.length === 10) {
    return trimmedPhone.trim();
  }
  throw new Error(`Invalid phone ${phone}`);
}

function normalizeAddressLine(addressLine: string): string {
  return toTitleCase(addressLine);
}

function normalizeCity(city: string): string {
  return toTitleCase(city);
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function normalizeZip(zip: string): string {
  return zip.trim();
}

function normalizeDate(date: string): string {
  const trimmedDate = date.trim();
  if (!dayjs(trimmedDate, "YYYY-MM-DD", true).isValid()) {
    throw new Error(`Invalid date ${date}`);
  }
  return trimmedDate;
}

function normalizeState(state: string): USState {
  if (Object.values(states).includes(USState[state as keyof typeof USState])) {
    return USState[state as keyof typeof USState];
  } else if (states[state]) {
    return states[state];
  }
  throw new Error(`Invalid state ${state}`);
}

const mapCSVPatientToMetriportPatient = (csvPatient: {
  firstname: string;
  lastname: string;
  dob: string;
  gender: string;
  zip: string;
  city: string;
  state: string;
  address1: string;
  phone: string;
  email: string;
}): PatientCreate | undefined => {
  return {
    firstName: normalizeName(csvPatient.firstname),
    lastName: normalizeName(csvPatient.lastname),
    dob: normalizeDate(csvPatient.dob),
    genderAtBirth: normalizeGender(csvPatient.gender),
    address: {
      addressLine1: normalizeAddressLine(csvPatient.address1),
      city: normalizeCity(csvPatient.city),
      state: normalizeState(csvPatient.state),
      zip: normalizeZip(csvPatient.zip),
      country: "USA",
    },
    contact: { phone: normalizePhone(csvPatient.phone), email: normalizeEmail(csvPatient.email) },
  };
};

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
