import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
import { MetriportMedicalApi, PatientCreate, PatientDTO } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import * as AWS from "aws-sdk";
import axios from "axios";
import { seedData } from "../../../api/src/shared/sandbox/sandbox-seed-data";
import { uuidv7 } from "../shared/uuid-v7";

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

const orgId = getEnvVarOrFail("DOCUMENT_CONTRIBUTION_ORGANIZATION_ID");
const orgName = getEnvVarOrFail("DOCUMENT_CONTRIBUTION_ORGANIZATION_NAME");

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

  const facilityPatients = await metriportAPI.listPatients(facilityId);

  const patients = Object.values(seedData).map(v => {
    const patient: PatientCreate = {
      ...v.demographics,
      address: v.demographics.address.map(a => ({
        ...a,
        addressLine1: a.addressLine1,
        addressLine2: a.addressLine2 ?? "",
        city: a.city,
        state: a.state,
        zip: a.zip,
        country: "USA",
      })),
    };
    const docs = v.docRefs.map((d, idx) => ({
      description: `${patient.firstName} ${patient.lastName} ${idx}`,
      fileName: d.s3Info.key,
    }));
    return { patient, docs };
  });
  for (const patient of patients) {
    let currentPatient: PatientDTO | undefined = facilityPatients.find(
      p => p.firstName === patient.patient.firstName
    );

    if (!currentPatient) {
      currentPatient = await metriportAPI.createPatient(patient.patient, facilityId);
      console.log(`Created patient ${JSON.stringify(currentPatient, null, 2)}`);
    }

    if (currentPatient) {
      for (const doc of patient.docs) {
        await addDocumentToS3AndToFHIRServer(currentPatient?.id ?? "", doc);
      }
    }
  }
}

async function addDocumentToS3AndToFHIRServer(patientId: string, doc: Doc): Promise<void> {
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

  const docRefId = uuidv7();

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
