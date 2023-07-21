import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
import { MetriportMedicalApi, Organization } from "@metriport/api-sdk";
import { patients } from "./patients";
import axios from "axios";
import * as AWS from "aws-sdk";
import { getEnvVarOrFail } from "../shared/env";

export type Doc = {
  description: string;
  fileName: string;
};

const AXIOS_TIMEOUT_MILLIS = 20_000;

/**
 * Initializes cw test env in staging
 */

const stagingTestAccountAPIKey = getEnvVarOrFail("COMMONWELL_ORG_PRIVATE_KEY");
const facilityId = getEnvVarOrFail("FACILITY_ID");

const docUrl = getEnvVarOrFail("DOCUMENT_CONTRIBUTION_URL");
const stagingApiUrl = getEnvVarOrFail("METRIPORT_API_URL");
const bucketName = getEnvVarOrFail("S3_BUCKET_NAME");
const seedBucketName = getEnvVarOrFail("S3_SEED_BUCKET_NAME");
const region = getEnvVarOrFail("REGION");

const s3 = new AWS.S3({ signatureVersion: "v4", region });

async function main() {
  const metriportAPI = new MetriportMedicalApi(stagingTestAccountAPIKey, {
    baseAddress: stagingApiUrl,
  });

  const org = await metriportAPI.getOrganization();

  const facilityPatients = await metriportAPI.listPatients(facilityId);

  for (const patient of patients) {
    let currentPatient = facilityPatients.find(p => p.firstName === patient.patient.firstName);

    if (!currentPatient) {
      currentPatient = await metriportAPI.createPatient(patient.patient, facilityId);
      console.log(`Created patient ${JSON.stringify(currentPatient, null, 2)}`);
    }

    let index = 0;

    if (currentPatient && org) {
      for (const doc of patient.docs) {
        await addDocumentToS3AndToFHIRServer(currentPatient?.id ?? "", doc, index, org);

        index += 1;
      }
    }
  }
}

async function addDocumentToS3AndToFHIRServer(
  patientId: string,
  doc: Doc,
  docIndex: number,
  org: Organization
): Promise<void> {
  const fhirApi = axios.create({
    timeout: AXIOS_TIMEOUT_MILLIS,
    baseURL: `${stagingApiUrl}/fhir/R4`,
    headers: {
      "x-api-key": stagingTestAccountAPIKey,
    },
  });

  const obj = await s3.getObject({ Bucket: seedBucketName, Key: doc.fileName }).promise();

  const uploaded = await s3
    .upload({
      Bucket: bucketName,
      Key: doc.fileName,
      Body: obj.Body,
      ContentType: obj.ContentType,
    })
    .promise();

  console.log(`Uploaded, file info: ${JSON.stringify(uploaded)}`);

  const index = patientId.lastIndexOf(".");
  const patientNumber = patientId.substring(index + 1);

  const docRefId = `${org.id}.${patientNumber}.${docIndex}`;

  const data = `{
      "resourceType": "DocumentReference",
      "id": "${docRefId}",
      "contained": [
          {
              "resourceType": "Organization",
              "id": "${org.id}",
              "name": "${org.name}"
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
              "reference": "#${org.id}",
              "type": "Organization"
          }
      ],
      "description": "${doc.description}",
      "content": [
          {
              "attachment": {
                  "contentType": "${obj.ContentType}",
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
}

main();
