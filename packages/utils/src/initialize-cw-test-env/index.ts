import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
// import { MetriportMedicalApi } from "@metriport/api-sdk";
import { patients } from "./patients";
import axios from "axios";
// import * as fs from "fs";
// import { janeDocs } from "./jane";
import { ollieDocs } from "./ollie";
import { andreasDocs } from "./andreas";

export type Doc = {
  index: number;
  description: string;
  fileName: string;
};

const AXIOS_TIMEOUT_MILLIS = 20_000;

/**
 * Initializes cw test env in staging
 */

const stagingTestAccountAPIKey = getEnvVarOrFail("COMMONWELL_ORG_PRIVATE_KEY");
// const facilityId = getEnvVarOrFail("FACILITY_ID");

const orgId = getEnvVarOrFail("DOCUMENT_CONTRIBUTION_ORGANIZATION_ID");
const orgName = getEnvVarOrFail("DOCUMENT_CONTRIBUTION_ORGANIZATION_NAME");

const docUrl = getEnvVarOrFail("DOCUMENT_CONTRIBUTION_URL");
const stagingApiUrl = getEnvVarOrFail("METRIPORT_API_URL");

async function main() {
  // const metriportAPI = new MetriportMedicalApi(stagingTestAccountAPIKey, {
  //   baseAddress: stagingApiUrl,
  // });

  for (const patient of patients) {
    // const createdPatient = await metriportAPI.createPatient(patient, facilityId);
    // console.log(`Created patient ${JSON.stringify(createdPatient, null, 2)}`);

    if (patient.firstName === "Andreas") {
      andreasDocs.forEach(async (doc: Doc) => {
        await addDocumentRefAndBinaryToFHIRServer("2.16.840.1.113883.3.9621.5.109.2.106", doc);
      });
    }
  }
}

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

async function addDocumentRefAndBinaryToFHIRServer(
  patientId: string,
  doc: Doc
): Promise<{ docRefId: string; binaryId: string }> {
  const fhirApi = axios.create({
    timeout: AXIOS_TIMEOUT_MILLIS,
    baseURL: `${stagingApiUrl}/fhir/R4`,
    headers: {
      "x-api-key": stagingTestAccountAPIKey,
    },
  });

  const binaryId = `${orgId}.${doc.index}`;
  const docRefId = `${orgId}.${doc.index}`;

  console.log(docRefId);

  const data = `{
    "resourceType": "DocumentReference",
    "id": "${docRefId}",
    "contained": [
        {
            "resourceType": "Organization",
            "id": "${orgId}",
            "name": "${orgName}"
        },
        {
            "resourceType": "Patient",
            "id": "${patientId}"
        }
    ],
    "masterIdentifier": {
        "system": "urn:ietf:rfc:3986",
        "value": "${docRefId}"
    },
    "identifier": [
        {
            "use": "official",
            "system": "urn:ietf:rfc:3986",
            "value": "${docRefId}"
        }
    ],
    "status": "current",
    "type": {
      "coding": [
          {
              "system": "http://loinc.org/",
              "code": "75622-1",
              "display":  "${doc.description}"
          }
      ]
    },
    "subject": {
        "reference": "Patient/${patientId}",
        "type": "Patient"
    },
    "author": [
        {
            "reference": "#${orgId}",
            "type": "Organization"
        }
    ],
    "description": "${doc.description}",
    "content": [
        {
            "attachment": {
                "contentType": "application/xml",
                "url": "${docUrl}?fileName=${doc.fileName}"
            }
        }
    ],
    "context": {
      "period": {
          "start": "2022-10-05T22:00:00.000Z",
          "end": "2022-10-05T23:00:00.000Z"
      },
      "sourcePatientInfo": {
          "reference": "#${patientId}",
          "type": "Patient"
      }
  }
}`;

  await fhirApi.put(`/DocumentReference/${docRefId}`, JSON.parse(data));

  return { docRefId, binaryId };
}

main();

// CREATE MULTIPLE PATIENTS UNDER FACILITY
// ADD THE BINARY DOCUMENTS TO THE FHIR SERVER
// ADD THE BINARY DOCUMENT REFERENCES TO THE FHIR SERVER
