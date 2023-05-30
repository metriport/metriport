#!/usr/bin/env node
import { APIMode, CommonWell, isLOLA1, RequestMetadata } from "@metriport/commonwell-sdk";
import axios, { AxiosInstance } from "axios";
import * as fs from "fs";
import { cloneDeep } from "lodash";
import {
  certificate,
  makeDocContribOrganization,
  makeDocPerson,
  makeId,
  makePatient,
} from "./payloads";
import { findOrCreatePatient, findOrCreatePerson } from "./shared-person";
import { filterTruthy, getEnv, getEnvOrFail } from "./util";

const AXIOS_TIMEOUT_MILLIS = 20_000;

// Document Contribution
// https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/Document-Contribution-(SOAP,-REST).aspx

const commonwellPrivateKey = getEnvOrFail("COMMONWELL_ORG_PRIVATE_KEY");
const commonwellCert = getEnvOrFail("COMMONWELL_ORG_CERTIFICATE");

const orgIdSuffix = getEnvOrFail("DOCUMENT_CONTRIBUTION_ORGANIZATION_ID");

const firstName = getEnv("DOCUMENT_CONTRIBUTION_PATIENT_FIRST_NAME");
const lastName = getEnv("DOCUMENT_CONTRIBUTION_PATIENT_LAST_NAME");
const dob = getEnv("DOCUMENT_CONTRIBUTION_PATIENT_DATE_OF_BIRTH");
const gender = getEnv("DOCUMENT_CONTRIBUTION_PATIENT_GENDER");
const zip = getEnv("DOCUMENT_CONTRIBUTION_PATIENT_ZIP");

const fhirUrl = getEnvOrFail("DOCUMENT_CONTRIBUTION_FHIR_URL");
const docUrl = getEnvOrFail("DOCUMENT_CONTRIBUTION_URL");
const rootOid = getEnvOrFail("COMMONWELL_OID");

export async function documentContribution({
  memberManagementApi,
  api: apiDefaultOrg,
  queryMeta,
}: {
  memberManagementApi: CommonWell;
  api: CommonWell;
  queryMeta: RequestMetadata;
}) {
  console.log(`>>> E3: Query for documents served by Metriport's FHIR server`);
  if (!firstName) {
    console.log(`Skipping E3 because no first name provided`);
    return;
  }
  if (!lastName) {
    console.log(`Skipping E3 because no last name provided`);
    return;
  }
  if (!zip) {
    console.log(`Skipping E3 because no zip provided`);
    return;
  }
  if (!dob) {
    console.log(`Skipping E3 because no date of birth provided`);
    return;
  }
  if (!gender) {
    console.log(`Skipping E3 because no gender provided`);
    return;
  }

  const {
    orgAPI: apiNewOrg,
    orgName,
    orgId,
  } = await getOrCreateOrg(memberManagementApi, queryMeta);

  const person = makeDocPerson({
    firstName,
    lastName,
    zip,
    gender,
    dob,
    facilityId: apiDefaultOrg.oid,
  });

  console.log(`Find or create patient and person on main org`);
  const { personId, patientId: patientIdMainOrg } = await findOrCreatePerson(
    apiDefaultOrg,
    queryMeta,
    person
  );
  console.log(`personId: ${personId}`);
  console.log(`patientId on main org: ${patientIdMainOrg}`);

  const newPerson = cloneDeep(person);
  newPerson.identifier = makePatient({ facilityId: apiNewOrg.oid }).identifier;
  if (newPerson.identifier) {
    newPerson.identifier[0].assigner = orgName;
    newPerson.identifier[0].label = orgName;
  }
  const { patientId: patientIdNewOrg } = await findOrCreatePatient(
    apiNewOrg,
    queryMeta,
    newPerson,
    personId
  );
  console.log(`patientId: ${patientIdNewOrg}`);

  console.log(`Get patients links`);
  const respGetLinks = await apiNewOrg.getNetworkLinks(queryMeta, patientIdNewOrg);
  console.log(respGetLinks);

  const allLinks = respGetLinks._embedded.networkLink
    ? respGetLinks._embedded.networkLink.flatMap(filterTruthy)
    : [];
  const lola1Links = allLinks.filter(isLOLA1);
  console.log(`Found ${allLinks.length} network links, ${lola1Links.length} are LOLA 1`);
  for (const link of lola1Links) {
    const upgradeURL = link._links?.upgrade?.href;
    if (!upgradeURL) {
      console.log(`[queryDocuments] missing upgrade URL for link `, link);
      continue;
    }
    const respUpgradeLink = await apiNewOrg.upgradeOrDowngradeNetworkLink(queryMeta, upgradeURL);
    console.log(respUpgradeLink);
  }

  console.log(`>>> [E3] Populating test data on FHIR server...`);
  const fhirApi = axios.create({
    timeout: AXIOS_TIMEOUT_MILLIS,
    baseURL: fhirUrl,
  });
  // TODO: #230 we could split convertPatientIdToSubjectId() in two and reuse the part that splits the CW patientId.
  const newPatientId = patientIdNewOrg.split("%5E%5E%5E")[0];
  await addOrgToFHIRServer(orgId, orgName, fhirApi);
  await addPatientToFHIRServer(newPatientId, fhirApi);
  await addDocumentRefAndBinaryToFHIRServer(newPatientId, orgId, orgName, fhirApi);

  console.log(`>>> [E3] Querying for docs from the main org...`);
  const respDocQuery = await apiDefaultOrg.queryDocuments(queryMeta, patientIdMainOrg);
  console.log(respDocQuery);
  const documents = respDocQuery.entry ?? [];
  for (const doc of documents) {
    console.log(`DOCUMENT: ${JSON.stringify(doc, undefined, 2)}`);

    // store the query result as well
    const queryFileName = `./cw_contribution_${doc.id ?? "ID"}_${makeId()}.response.file`;
    fs.writeFileSync(queryFileName, JSON.stringify(doc));

    const fileName = `./cw_contribution_${doc.id ?? "ID"}_${makeId()}.contents.file`;
    // the default is UTF-8, avoid changing the encoding if we don't know the file we're downloading
    const outputStream = fs.createWriteStream(fileName, { encoding: undefined });
    console.log(`File being created at ${process.cwd()}/${fileName}`);
    const url = doc.content?.location;
    if (url != null) await apiDefaultOrg.retrieveDocument(queryMeta, url, outputStream);
  }
}

async function getOrCreateOrg(
  memberManagementApi: CommonWell,
  queryMeta: RequestMetadata
): Promise<{ orgAPI: CommonWell; orgName: string; orgId: string }> {
  const orgPayload = makeDocContribOrganization(orgIdSuffix);
  const orgId = orgPayload.organizationId;
  const orgIdWithoutNamespace = orgId.slice("urn:oid:".length);
  const orgName = orgPayload.name;
  console.log(`Get the doc org - ID ${orgId}, name ${orgName}`);
  const respGetOneOrg = await memberManagementApi.getOneOrg(queryMeta, orgId);
  console.log(respGetOneOrg);
  if (!respGetOneOrg) {
    console.log(`Doc org not found, create one`);
    const respCreateOrg = await memberManagementApi.createOrg(queryMeta, orgPayload);
    console.log(respCreateOrg);
    console.log(`Add certificate to doc org`);
    const respAddCertificateToOrg = await memberManagementApi.addCertificateToOrg(
      queryMeta,
      certificate,
      orgIdWithoutNamespace
    );
    console.log(respAddCertificateToOrg);
  }

  const orgAPI = new CommonWell(
    commonwellCert,
    commonwellPrivateKey,
    orgName, //commonwellSandboxOrgName,
    orgIdWithoutNamespace, //commonwellSandboxOID,
    APIMode.integration
  );

  return { orgAPI, orgName, orgId: orgIdWithoutNamespace };
}

async function addOrgToFHIRServer(orgId: string, orgName: string, fhirApi: AxiosInstance) {
  // TODO: #230 we could create data as a JS structure instead of string - easier for future code enhancements and maintenance.
  const data = `{
    "resourceType": "Organization",
    "id": "${orgId}",
    "meta": {
        "versionId": "1",
        "lastUpdated": "2023-02-04T13:23:38.744+00:00",
        "source": "${rootOid}"
    },
    "identifier": [
        {
            "system": "urn:ietf:rfc:3986",
            "value": "${orgId}"
        }
    ],
    "active": true,
    "type": [
        {
            "coding": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/organization-type",
                    "code": "prov",
                    "display": "Healthcare Provider"
                }
            ],
            "text": "Healthcare Provider"
        }
    ],
    "name": "${orgName}",
    "telecom": [
        {
            "system": "phone",
            "value": "5088287000"
        }
    ],
    "address": [
        {
            "line": [
                "88 WASHINGTON STREET"
            ],
            "city": "TAUNTON",
            "state": "MA",
            "postalCode": "02780",
            "country": "US"
        }
    ]
}`;
  await fhirApi.put(`/Organization/${orgId}`, JSON.parse(data));
}

async function addPatientToFHIRServer(patientId: string, fhirApi: AxiosInstance) {
  const data = `{
    "resourceType": "Patient",
    "id": "${patientId}",
    "meta": {
        "versionId": "6",
        "lastUpdated": "2023-02-15T22:27:07.642+00:00",
        "source": "${rootOid}"
    },
    "extension": [
        {
            "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race",
            "extension": [
                {
                    "url": "ombCategory",
                    "valueCoding": {
                        "system": "urn:oid:2.16.840.1.113883.6.238",
                        "code": "2106-3",
                        "display": "White"
                    }
                },
                {
                    "url": "text",
                    "valueString": "White"
                }
            ]
        },
        {
            "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity",
            "extension": [
                {
                    "url": "ombCategory",
                    "valueCoding": {
                        "system": "urn:oid:2.16.840.1.113883.6.238",
                        "code": "2186-5",
                        "display": "Not Hispanic or Latino"
                    }
                },
                {
                    "url": "text",
                    "valueString": "Not Hispanic or Latino"
                }
            ]
        },
        {
            "url": "http://hl7.org/fhir/StructureDefinition/patient-mothersMaidenName",
            "valueString": "Deadra347 Borer986"
        },
        {
            "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex",
            "valueCode": "M"
        },
        {
            "url": "http://hl7.org/fhir/StructureDefinition/patient-birthPlace",
            "valueAddress": {
                "city": "Billerica",
                "state": "Massachusetts",
                "country": "US"
            }
        },
        {
            "url": "http://synthetichealth.github.io/synthea/disability-adjusted-life-years",
            "valueDecimal": 14.062655945052095
        },
        {
            "url": "http://synthetichealth.github.io/synthea/quality-adjusted-life-years",
            "valueDecimal": 58.93734405494791
        }
    ],
    "identifier": [
        {
            "system": "https://github.com/synthetichealth/synthea",
            "value": "2fa15bc7-8866-461a-9000-f739e425860a"
        },
        {
            "type": {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                        "code": "MR",
                        "display": "Medical Record Number"
                    }
                ],
                "text": "Medical Record Number"
            },
            "system": "http://hospital.smarthealthit.org",
            "value": "2fa15bc7-8866-461a-9000-f739e425860a"
        },
        {
            "type": {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                        "code": "SS",
                        "display": "Social Security Number"
                    }
                ],
                "text": "Social Security Number"
            },
            "system": "http://hl7.org/fhir/sid/us-ssn",
            "value": "999-93-7537"
        },
        {
            "type": {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                        "code": "DL",
                        "display": "Driver's License"
                    }
                ],
                "text": "Driver's License"
            },
            "system": "urn:oid:2.16.840.1.113883.4.3.25",
            "value": "S99948707"
        },
        {
            "type": {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                        "code": "PPN",
                        "display": "Passport Number"
                    }
                ],
                "text": "Passport Number"
            },
            "system": "http://standardhealthrecord.org/fhir/StructureDefinition/passportNumber",
            "value": "X14078167X"
        }
    ],
    "name": [
        {
            "use": "official",
            "family": "Rockefeller54",
            "given": [
                "Jonathan54"
            ],
            "prefix": [
                "Mr."
            ]
        }
    ],
    "telecom": [
        {
            "system": "phone",
            "value": "555-677-3119",
            "use": "home"
        }
    ],
    "gender": "male",
    "birthDate": "1983-12-22",
    "address": [
        {
            "extension": [
                {
                    "url": "http://hl7.org/fhir/StructureDefinition/geolocation",
                    "extension": [
                        {
                            "url": "latitude",
                            "valueDecimal": 41.93879298871088
                        },
                        {
                            "url": "longitude",
                            "valueDecimal": -71.06682353144593
                        }
                    ]
                }
            ],
            "line": [
                "894 Brakus Bypass"
            ],
            "city": "San Francisco",
            "state": "California",
            "postalCode": "81547",
            "country": "US"
        }
    ],
    "maritalStatus": {
        "coding": [
            {
                "system": "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus",
                "code": "S",
                "display": "S"
            }
        ],
        "text": "S"
    },
    "multipleBirthBoolean": false,
    "communication": [
        {
            "language": {
                "coding": [
                    {
                        "system": "urn:ietf:bcp:47",
                        "code": "en-US",
                        "display": "English"
                    }
                ],
                "text": "English"
            }
        }
    ]
}`;
  await fhirApi.put(`/Patient/${patientId}`, JSON.parse(data));
}

async function addDocumentRefAndBinaryToFHIRServer(
  patientId: string,
  orgId: string,
  orgName: string,
  fhirApi: AxiosInstance
): Promise<{ docRefId: string; binaryId: string }> {
  const binaryId = `${orgId}.969696`;
  const payload = fs.readFileSync("./data/doc-contrib-payload");
  const binaryData = `{
    "resourceType": "Binary",
    "id": "${binaryId}",
    "contentType": "application/xml",
    "data": "${payload}"
}`;
  await fhirApi.put(`/Binary/${binaryId}`, JSON.parse(binaryData));

  const docRefId = `${orgId}.696969`;
  const data = `{
    "resourceType": "DocumentReference",
    "id": "${docRefId}",
    "meta": {
        "versionId": "19",
        "lastUpdated": "2023-02-24T16:07:16.796+00:00",
        "source": "${rootOid}"
    },
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
                "display": "HIV 1 and 2 tests - Meaningful Use set"
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
    "description": "Summarization Of Episode Notes - provided by Metriport",
    "content": [
        {
            "attachment": {
                "contentType": "application/xml",
                "url": "${docUrl}/Binary/${binaryId}"
            }
        }
    ],
    "context": {
        "event": [
            {
                "coding": [
                    {
                        "system": "http://snomed.info/sct",
                        "code": "62479008",
                        "display": "AIDS"
                    }
                ],
                "text": "AIDS"
            }
        ],
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
