import dotenv from "dotenv";
dotenv.config();

import axios from "axios";
import { MetriportMedicalApi, PatientDTO } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import fs from "fs";
import { patientsToCreate } from "./patients";

const apiKey = getEnvVarOrFail("API_KEY");
const apiUrl = getEnvVarOrFail("API_URL");
const facilityId = getEnvVarOrFail("FACILITY_ID");

const metriportApi = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
});

const api = axios.create();

/**
 * Number of documents to upload for each patient based on type.
 */
const NUM_XML = 300;
const NUM_PDF = 100;
const NUM_JPEG = 100;

/**
 * Files to upload for each patient.
 */
const xmlFile = fs.readFileSync(`path-to-xml-file`);
const pdfFile = fs.readFileSync(`path-to-pdf-file`);
const jpegFile = fs.readFileSync(`path-to-jpeg-file`);

/**
 * Doc ref to upload for each document
 */
const docRefBase = {
  type: {
    text: "Injury Hospital Progress note",
    coding: [
      {
        code: "100556-0",
        system: "http://loinc.org",
      },
    ],
  },
  context: {
    period: {
      start: "2023-10-24T14:14:17Z",
    },
    facilityType: {
      coding: [
        {
          code: "418518002",
          display: "Hospital",
        },
      ],
    },
    practiceSetting: {
      coding: [
        {
          code: "394612005",
          display: "Hospital",
        },
      ],
    },
  },
};

/**
 * Utility to create patients and upload documents for testing.
 *
 * This will:
 *   - create a new patient for each patient in `patientsToCreate`
 *   - upload a set number of documents for each patient
 *
 * Update the respective env variables and run `ts-node populate-patient-docs.ts`
 *
 */
async function main() {
  try {
    for (const patient of patientsToCreate) {
      const createdPatient = await metriportApi.createPatient(patient, facilityId);
      console.log("Patient created:", createdPatient.id, patient.firstName, patient.lastName);

      await Promise.all([
        uploadDocType(createdPatient, "xml", NUM_XML),
        uploadDocType(createdPatient, "pdf", NUM_PDF),
        uploadDocType(createdPatient, "jpeg", NUM_JPEG),
      ]);
    }
  } catch (err) {
    console.log("ERROR:", err);
  }
}

const uploadDocType = async (patient: PatientDTO, type: "xml" | "pdf" | "jpeg", count: number) => {
  for (let i = 0; i < count; i++) {
    try {
      const docRef = {
        description: `${patient.firstName} ${patient.lastName} injury ${i} ${type}`,
        ...docRefBase,
      };

      const createDocReference = await metriportApi.createDocumentReference(patient.id, docRef);

      const url = createDocReference.uploadUrl;

      console.log("URL:", url);

      let file;

      if (type === "xml") {
        file = xmlFile;
      } else if (type === "pdf") {
        file = pdfFile;
      } else if (type === "jpeg") {
        file = jpegFile;
      }

      const baseContentType = type === "jpeg" ? "image" : "application";

      const succ = await api.put(url, file, {
        headers: {
          "Content-Type": `${baseContentType}/${type}`,
        },
      });

      console.log("SUCCESS:", succ.status);
      console.log("DONE:", `${patient.firstName} ${patient.lastName}`, type, i);
    } catch (error) {
      console.log("ERROR:", error);
    }
  }
};

main();
