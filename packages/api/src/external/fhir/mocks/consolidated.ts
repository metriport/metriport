import { BundleEntry } from "@medplum/fhirtypes";
import { v4 as uuidv4 } from "uuid";

export function makeConsolidatedMockBundle(): BundleEntry[] {
  const cxId = uuidv4();
  const orgId = uuidv4();
  const orgName = `Org ${orgId}`;
  return [
    {
      fullUrl: `https://api.metriport.com/oauth/fhir/${cxId}/AllergyIntolerance/ae2cf1de-0ad6-3cbb-9faf-8edaf975a662`,
      resource: {
        resourceType: "AllergyIntolerance",
        id: "ae2cf1de-0ad6-3cbb-9faf-8edaf975a662",
        meta: {
          versionId: "1",
          lastUpdated: "2023-04-16T22:04:35.015+00:00",
          source: "#DBhQqunVsW5BE5wr",
        },
        identifier: [
          {
            system: "urn:ietf:rfc:3986",
            value: "urn:uuid:9d643a3c-f3fe-11ed-9449-d327957cccb9",
          },
        ],
        clinicalStatus: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
              code: "resolved",
            },
          ],
        },
        patient: {
          reference: `Patient/${orgId}.2.101`,
        },
      },
      search: {
        mode: "match",
      },
    },
    {
      fullUrl: `https://api.metriport.com/oauth/fhir/${cxId}/Condition/5f0cad95-aa2b-3f0f-aef8-858fb715080f`,
      resource: {
        resourceType: "Condition",
        id: "5f0cad95-aa2b-3f0f-aef8-858fb715080f",
        meta: {
          versionId: "1",
          lastUpdated: "2023-04-16T22:04:35.162+00:00",
          source: "#DBhQqunVsW5BE5wr",
        },
        identifier: [
          {
            system: "urn:ietf:rfc:3986",
            value: "urn:uuid:9d670df2-f3fe-11ed-b00b-d327957cccb9",
          },
        ],
        subject: {
          reference: `Patient/${orgId}.2.101`,
        },
      },
      search: {
        mode: "match",
      },
    },
    {
      fullUrl: `https://api.metriport.com/oauth/fhir/${cxId}/DiagnosticReport/fde6502f-c561-32ca-9849-c17f5034294f`,
      resource: {
        resourceType: "DiagnosticReport",
        id: "fde6502f-c561-32ca-9849-c17f5034294f",
        meta: {
          versionId: "1",
          lastUpdated: "2023-04-16T22:09:51.794+00:00",
          source: "#P03ku4kb0NiFEjV4",
        },
        identifier: [
          {
            system: "urn:ietf:rfc:3986",
            value: "urn:uuid:9d683042-f3fe-11ed-a6b4-d327957cccb9",
          },
        ],
        status: "final",
        code: {
          coding: [
            {
              display: "urinalysis microscopic panel, automated",
            },
          ],
        },
        subject: {
          reference: `Patient/${orgId}.2.101`,
        },
        effectivePeriod: {
          start: "2022-07-20T18:19:50.000Z",
        },
        result: [
          {
            reference: "Observation/979a31ae-92bc-3a7a-884d-b50064dfa58c",
          },
          {
            reference: "Observation/e84f36a9-1cbb-3da9-90e9-1d2fb53667d7",
          },
          {
            reference: "Observation/acd06387-7a76-3b5b-bc3b-8a2db1890adf",
          },
          {
            reference: "Observation/e9313c4a-596b-365c-8248-488098a7e2d1",
          },
          {
            reference: "Observation/b85c06c1-7595-36e2-8a04-1f24584e56b8",
          },
          {
            reference: "Observation/9e921610-81b9-3679-893a-c758bbf535cc",
          },
          {
            reference: "Observation/2024c2e3-801a-3f29-b0d7-332613aa482f",
          },
          {
            reference: "Observation/2176deee-6138-3bc4-b16a-a8a3db19e3aa",
          },
          {
            reference: "Observation/704d8680-2985-3a4f-a1ef-e95d91cbf097",
          },
          {
            reference: "Observation/144f73af-644c-3376-8776-6448772c1aff",
          },
          {
            reference: "Observation/8639a824-80c7-30eb-9536-cc246e60c7f8",
          },
          {
            reference: "Observation/aabbf8f8-3764-3443-8c7b-5c789c911cbf",
          },
          {
            reference: "Observation/36d1cf11-48f2-3d3d-8810-517744362f82",
          },
          {
            reference: "Observation/72573c79-0a15-38b4-9a5e-f8a70dae5191",
          },
          {
            reference: "Observation/54661e49-8d7c-369c-9297-a21fbb8b6415",
          },
          {
            reference: "Observation/3cdc56a7-a4c5-3035-a323-fee2b499abb1",
          },
          {
            reference: "Observation/6e00cd41-4385-33d3-b38d-685fdee638d6",
          },
        ],
      },
      search: {
        mode: "match",
      },
    },
    {
      fullUrl: `https://api.metriport.com/oauth/fhir/${cxId}/DocumentReference/Mi4xNi44NDAuMS4xMTM4ODMuMy41NjQuOTk5OTk5LjUuOTk5OTk5`,
      resource: {
        resourceType: "DocumentReference",
        id: "Mi4xNi44NDAuMS4xMTM4ODMuMy41NjQuOTk5OTk5LjUuOTk5OTk5",
        meta: {
          versionId: "1",
          lastUpdated: "2023-04-14T22:51:53.057+00:00",
          source: "#QrfhY2w9ZeiOt35F",
        },
        contained: [
          {
            resourceType: "Organization",
            id: `${orgId}`,
            name: `${orgName}`,
          },
          {
            resourceType: "Patient",
            id: `${orgId}.2.101`,
          },
        ],
        extension: [
          {
            valueReference: {
              reference: "COMMONWELL",
            },
          },
        ],
        masterIdentifier: {
          system: "urn:ietf:rfc:3986",
          value: "2.16.840.1.113883.3.564.999999.5.999999",
        },
        identifier: [
          {
            use: "official",
            system: "urn:ietf:rfc:3986",
            value: "urn:uuid:B255756B-EAC8-4C2C-B2D6-B97823E5048D",
          },
        ],
        status: "current",
        type: {
          coding: [
            {
              system: "http://loinc.org/",
              code: "34133-9",
              display: "Ambulatory Summary",
            },
          ],
        },
        subject: {
          reference: `Patient/${orgId}.2.101`,
          type: "Patient",
        },
        date: "2023-04-14T22:51:50+00:00",
        author: [
          {
            reference: `#${orgId}`,
            type: "Organization",
          },
        ],
        custodian: {
          id: "2.16.840.1.113883.3.3330",
        },
        description: "Ambulatory Summary - Chart ID:123456",
        content: [
          {
            attachment: {
              contentType: "text/xml",
              url: `https://metriport-medical-documents.s3.us-west-1.amazonaws.com/${cxId}-Mi4xNi44NDAuMS4xMTM4ODMuMy41NjQuOTk5OTk5LjUuOTk5OTk5`,
              title: `${cxId}-Mi4xNi44NDAuMS4xMTM4ODMuMy41NjQuOTk5OTk5LjUuOTk5OTk5`,
              creation: "2023-04-14T22:51:50+00:00",
            },
          },
        ],
        context: {
          facilityType: {
            coding: [
              {
                system: "http://snomed.info/sct",
                code: "394777002",
                display: "Health Encounter Site",
              },
            ],
          },
        },
      },
      search: {
        mode: "match",
      },
    },
    {
      fullUrl: `https://api.metriport.com/oauth/fhir/${cxId}/DocumentReference/LjMuNTY0LjExMDg1LjUuOTk5OTk5OTk=`,
      resource: {
        resourceType: "DocumentReference",
        id: "LjMuNTY0LjExMDg1LjUuOTk5OTk5OTk=",
        meta: {
          versionId: "3",
          lastUpdated: "2023-04-16T22:09:52.248+00:00",
          source: "#WAypGWs07EBaMCMG",
        },
        contained: [
          {
            resourceType: "Organization",
            id: `${orgId}`,
            name: `${orgName}`,
          },
          {
            resourceType: "Patient",
            id: `${orgId}.2.101`,
          },
        ],
        extension: [
          {
            valueReference: {
              reference: "COMMONWELL",
            },
          },
        ],
        masterIdentifier: {
          system: "urn:ietf:rfc:3986",
          value: "2.16.840.1.113883.3.564.999999.5.999999",
        },
        identifier: [
          {
            use: "official",
            system: "urn:ietf:rfc:3986",
            value: "urn:uuid:5f05daec-f436-11ed-884a-5259567af8f8",
          },
        ],
        status: "current",
        type: {
          coding: [
            {
              system: "http://loinc.org/",
              code: "34133-9",
              display: "Ambulatory Summary",
            },
          ],
        },
        subject: {
          reference: `Patient/${orgId}.2.101`,
          type: "Patient",
        },
        date: "2023-04-16T22:09:48+00:00",
        author: [
          {
            reference: `#${orgId}`,
            type: "Organization",
          },
        ],
        custodian: {
          id: "2.16.840.1.113883.3.3330",
        },
        description: "Ambulatory Summary - Chart ID:123456",
        content: [
          {
            attachment: {
              contentType: "text/xml",
              url: `https://metriport-medical-documents.s3.us-west-1.amazonaws.com/${cxId}-LjMuNTY0LjExMDg1LjUuOTk5OTk5OTk=`,
              title: `${cxId}-LjMuNTY0LjExMDg1LjUuOTk5OTk5OTk=`,
              creation: "2023-04-16T22:09:48+00:00",
            },
          },
        ],
        context: {
          facilityType: {
            coding: [
              {
                system: "http://snomed.info/sct",
                code: "394777002",
                display: "Health Encounter Site",
              },
            ],
          },
        },
      },
      search: {
        mode: "match",
      },
    },
    {
      fullUrl: `https://api.metriport.com/oauth/fhir/${cxId}/Immunization/e430c4ae-2ddc-38a9-b854-f64093bcb4d8`,
      resource: {
        resourceType: "Immunization",
        id: "e430c4ae-2ddc-38a9-b854-f64093bcb4d8",
        meta: {
          versionId: "1",
          lastUpdated: "2023-04-16T22:04:37.095+00:00",
          source: "#DBhQqunVsW5BE5wr",
        },
        identifier: [
          {
            system: "urn:ietf:rfc:3986",
            value: "urn:uuid:9d725662-f3fe-11ed-9f18-d327957cccb9",
          },
        ],
        status: "completed",
        vaccineCode: {
          coding: [
            {
              system: "urn:oid:2.16.840.1.113883.12.292",
            },
          ],
        },
        patient: {
          reference: `Patient/${orgId}.2.101`,
        },
      },
      search: {
        mode: "match",
      },
    },
    {
      fullUrl: `https://api.metriport.com/oauth/fhir/${cxId}/MedicationStatement/846d4e11-65a2-343f-894d-8520ffbf617c`,
      resource: {
        resourceType: "MedicationStatement",
        id: "846d4e11-65a2-343f-894d-8520ffbf617c",
        meta: {
          versionId: "1",
          lastUpdated: "2023-04-16T22:09:51.722+00:00",
          source: "#P03ku4kb0NiFEjV4",
        },
        identifier: [
          {
            system: "urn:ietf:rfc:3986",
            value: "urn:uuid:9d658eaa-f3fe-11ed-ae3e-d327957cccb9",
          },
        ],
        status: "completed",
        medicationReference: {
          reference: "Medication/86036578-8899-3f3f-a449-23a79df47f89",
        },
        subject: {
          reference: `Patient/${orgId}.2.101`,
        },
      },
      search: {
        mode: "match",
      },
    },
    {
      fullUrl: `https://api.metriport.com/oauth/fhir/${cxId}/Observation/979a31ae-92bc-3a7a-884d-b50064dfa58c`,
      resource: {
        resourceType: "Observation",
        id: "979a31ae-92bc-3a7a-884d-b50064dfa58c",
        meta: {
          versionId: "1",
          lastUpdated: "2023-04-16T22:04:35.243+00:00",
          source: "#DBhQqunVsW5BE5wr",
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-observationresults"],
        },
        identifier: [
          {
            system: "urn:ietf:rfc:3986",
            value: "urn:uuid:9d686602-f3fe-11ed-955a-d327957cccb9",
          },
        ],
        status: "final",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "laboratory",
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: "http://loinc.org",
            },
          ],
        },
        subject: {
          reference: `Patient/${orgId}.2.101`,
        },
        effectiveDateTime: "2022-07-20T18:19:50.000Z",
        valueString: "Yellow",
      },
      search: {
        mode: "match",
      },
    },
    {
      fullUrl: `https://api.metriport.com/oauth/fhir/${cxId}/Observation/e84f36a9-1cbb-3da9-90e9-1d2fb53667d7`,
      resource: {
        resourceType: "Observation",
        id: "e84f36a9-1cbb-3da9-90e9-1d2fb53667d7",
        meta: {
          versionId: "1",
          lastUpdated: "2023-04-16T22:04:35.367+00:00",
          source: "#DBhQqunVsW5BE5wr",
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-observationresults"],
        },
        identifier: [
          {
            system: "urn:ietf:rfc:3986",
            value: "urn:uuid:9d68a374-f3fe-11ed-99ba-d327957cccb9",
          },
        ],
        status: "final",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "laboratory",
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: "http://loinc.org",
            },
          ],
        },
        subject: {
          reference: `Patient/${orgId}.2.101`,
        },
        effectiveDateTime: "2022-07-20T18:19:50.000Z",
        valueString: "Clear",
      },
      search: {
        mode: "match",
      },
    },
    {
      fullUrl: `https://api.metriport.com/oauth/fhir/${cxId}/Observation/acd06387-7a76-3b5b-bc3b-8a2db1890adf`,
      resource: {
        resourceType: "Observation",
        id: "acd06387-7a76-3b5b-bc3b-8a2db1890adf",
        meta: {
          versionId: "1",
          lastUpdated: "2023-04-16T22:04:35.442+00:00",
          source: "#DBhQqunVsW5BE5wr",
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-observationresults"],
        },
        identifier: [
          {
            system: "urn:ietf:rfc:3986",
            value: "urn:uuid:9d68db50-f3fe-11ed-99ba-d327957cccb9",
          },
        ],
        status: "final",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "laboratory",
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: "http://loinc.org",
            },
          ],
        },
        subject: {
          reference: `Patient/${orgId}.2.101`,
        },
        effectiveDateTime: "2022-07-20T18:19:50.000Z",
        valueString: "neg",
      },
      search: {
        mode: "match",
      },
    },
    {
      fullUrl: `https://api.metriport.com/oauth/fhir/${cxId}/Observation/e9313c4a-596b-365c-8248-488098a7e2d1`,
      resource: {
        resourceType: "Observation",
        id: "e9313c4a-596b-365c-8248-488098a7e2d1",
        meta: {
          versionId: "1",
          lastUpdated: "2023-04-16T22:04:35.561+00:00",
          source: "#DBhQqunVsW5BE5wr",
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-observationresults"],
        },
        identifier: [
          {
            system: "urn:ietf:rfc:3986",
            value: "urn:uuid:9d6910c0-f3fe-11ed-905a-d327957cccb9",
          },
        ],
        status: "final",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "laboratory",
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: "http://loinc.org",
            },
          ],
        },
        subject: {
          reference: `Patient/${orgId}.2.101`,
        },
        effectiveDateTime: "2022-07-20T18:19:50.000Z",
        valueString: "neg",
      },
      search: {
        mode: "match",
      },
    },
    {
      fullUrl: `https://api.metriport.com/oauth/fhir/${cxId}/Observation/b85c06c1-7595-36e2-8a04-1f24584e56b8`,
      resource: {
        resourceType: "Observation",
        id: "b85c06c1-7595-36e2-8a04-1f24584e56b8",
        meta: {
          versionId: "1",
          lastUpdated: "2023-04-16T22:04:35.635+00:00",
          source: "#DBhQqunVsW5BE5wr",
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-observationresults"],
        },
        identifier: [
          {
            system: "urn:ietf:rfc:3986",
            value: "urn:uuid:9d6945ea-f3fe-11ed-97e5-d327957cccb9",
          },
        ],
        status: "final",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "laboratory",
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: "http://loinc.org",
            },
          ],
        },
        subject: {
          reference: `Patient/${orgId}.2.101`,
        },
        effectiveDateTime: "2022-07-20T18:19:50.000Z",
        valueString: "neg",
      },
      search: {
        mode: "match",
      },
    },
    {
      fullUrl: `https://api.metriport.com/oauth/fhir/${cxId}/Observation/9e921610-81b9-3679-893a-c758bbf535cc`,
      resource: {
        resourceType: "Observation",
        id: "9e921610-81b9-3679-893a-c758bbf535cc",
        meta: {
          versionId: "1",
          lastUpdated: "2023-04-16T22:04:35.701+00:00",
          source: "#DBhQqunVsW5BE5wr",
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-observationresults"],
        },
        identifier: [
          {
            system: "urn:ietf:rfc:3986",
            value: "urn:uuid:9d697d08-f3fe-11ed-97e5-d327957cccb9",
          },
        ],
        status: "final",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "laboratory",
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: "http://loinc.org",
            },
          ],
        },
        subject: {
          reference: `Patient/${orgId}.2.101`,
        },
        effectiveDateTime: "2022-07-20T18:19:50.000Z",
        valueQuantity: {
          value: 1.015,
        },
      },
      search: {
        mode: "match",
      },
    },
    {
      fullUrl: `https://api.metriport.com/oauth/fhir/${cxId}/Observation/2024c2e3-801a-3f29-b0d7-332613aa482f`,
      resource: {
        resourceType: "Observation",
        id: "2024c2e3-801a-3f29-b0d7-332613aa482f",
        meta: {
          versionId: "1",
          lastUpdated: "2023-04-16T22:04:35.819+00:00",
          source: "#DBhQqunVsW5BE5wr",
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-observationresults"],
        },
        identifier: [
          {
            system: "urn:ietf:rfc:3986",
            value: "urn:uuid:9d69b19c-f3fe-11ed-b92a-d327957cccb9",
          },
        ],
        status: "final",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "laboratory",
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: "http://loinc.org",
            },
          ],
        },
        subject: {
          reference: `Patient/${orgId}.2.101`,
        },
        effectiveDateTime: "2022-07-20T18:19:50.000Z",
        valueString: "neg",
      },
      search: {
        mode: "match",
      },
    },
    {
      fullUrl: `https://api.metriport.com/oauth/fhir/${cxId}/Observation/2176deee-6138-3bc4-b16a-a8a3db19e3aa`,
      resource: {
        resourceType: "Observation",
        id: "2176deee-6138-3bc4-b16a-a8a3db19e3aa",
        meta: {
          versionId: "1",
          lastUpdated: "2023-04-16T22:04:35.886+00:00",
          source: "#DBhQqunVsW5BE5wr",
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-observationresults"],
        },
        identifier: [
          {
            system: "urn:ietf:rfc:3986",
            value: "urn:uuid:9d6a03f4-f3fe-11ed-b92a-d327957cccb9",
          },
        ],
        status: "final",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "laboratory",
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: "http://loinc.org",
            },
          ],
        },
        subject: {
          reference: `Patient/${orgId}.2.101`,
        },
        effectiveDateTime: "2022-07-20T18:19:50.000Z",
        valueQuantity: {
          value: 6.5,
        },
      },
      search: {
        mode: "match",
      },
    },
    {
      fullUrl: `https://api.metriport.com/oauth/fhir/${cxId}/Observation/704d8680-2985-3a4f-a1ef-e95d91cbf097`,
      resource: {
        resourceType: "Observation",
        id: "704d8680-2985-3a4f-a1ef-e95d91cbf097",
        meta: {
          versionId: "1",
          lastUpdated: "2023-04-16T22:04:35.961+00:00",
          source: "#DBhQqunVsW5BE5wr",
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-observationresults"],
        },
        identifier: [
          {
            system: "urn:ietf:rfc:3986",
            value: "urn:uuid:9d6a5430-f3fe-11ed-93cf-d327957cccb9",
          },
        ],
        status: "final",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "laboratory",
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: "http://loinc.org",
            },
          ],
        },
        subject: {
          reference: `Patient/${orgId}.2.101`,
        },
        effectiveDateTime: "2022-07-20T18:19:50.000Z",
        valueString: "+-",
      },
      search: {
        mode: "match",
      },
    },
    {
      fullUrl: `https://api.metriport.com/oauth/fhir/${cxId}/Observation/144f73af-644c-3376-8776-6448772c1aff`,
      resource: {
        resourceType: "Observation",
        id: "144f73af-644c-3376-8776-6448772c1aff",
        meta: {
          versionId: "1",
          lastUpdated: "2023-04-16T22:04:36.023+00:00",
          source: "#DBhQqunVsW5BE5wr",
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-observationresults"],
        },
        identifier: [
          {
            system: "urn:ietf:rfc:3986",
            value: "urn:uuid:9d6aa408-f3fe-11ed-834d-d327957cccb9",
          },
        ],
        status: "final",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "laboratory",
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: "http://loinc.org",
            },
          ],
        },
        subject: {
          reference: `Patient/${orgId}.2.101`,
        },
        effectiveDateTime: "2022-07-20T18:19:50.000Z",
        valueQuantity: {
          value: 3.5,
          unit: "mg/dL",
        },
      },
      search: {
        mode: "match",
      },
    },
    {
      fullUrl: `https://api.metriport.com/oauth/fhir/${cxId}/Observation/8639a824-80c7-30eb-9536-cc246e60c7f8`,
      resource: {
        resourceType: "Observation",
        id: "8639a824-80c7-30eb-9536-cc246e60c7f8",
        meta: {
          versionId: "1",
          lastUpdated: "2023-04-16T22:04:36.109+00:00",
          source: "#DBhQqunVsW5BE5wr",
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-observationresults"],
        },
        identifier: [
          {
            system: "urn:ietf:rfc:3986",
            value: "urn:uuid:9d6af840-f3fe-11ed-b85c-d327957cccb9",
          },
        ],
        status: "final",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "laboratory",
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: "http://loinc.org",
            },
          ],
        },
        subject: {
          reference: `Patient/${orgId}.2.101`,
        },
        effectiveDateTime: "2022-07-20T18:19:50.000Z",
        valueString: "neg",
      },
      search: {
        mode: "match",
      },
    },
    {
      fullUrl: `https://api.metriport.com/oauth/fhir/${cxId}/Observation/aabbf8f8-3764-3443-8c7b-5c789c911cbf`,
      resource: {
        resourceType: "Observation",
        id: "aabbf8f8-3764-3443-8c7b-5c789c911cbf",
        meta: {
          versionId: "1",
          lastUpdated: "2023-04-16T22:04:36.172+00:00",
          source: "#DBhQqunVsW5BE5wr",
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-observationresults"],
        },
        identifier: [
          {
            system: "urn:ietf:rfc:3986",
            value: "urn:uuid:9d6b35da-f3fe-11ed-9543-d327957cccb9",
          },
        ],
        status: "final",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "laboratory",
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: "http://loinc.org",
            },
          ],
        },
        subject: {
          reference: `Patient/${orgId}.2.101`,
        },
        effectiveDateTime: "2022-07-20T18:19:50.000Z",
        valueString: "neg",
      },
      search: {
        mode: "match",
      },
    },
    {
      fullUrl: `https://api.metriport.com/oauth/fhir/${cxId}/Observation/36d1cf11-48f2-3d3d-8810-517744362f82`,
      resource: {
        resourceType: "Observation",
        id: "36d1cf11-48f2-3d3d-8810-517744362f82",
        meta: {
          versionId: "1",
          lastUpdated: "2023-04-16T22:04:36.265+00:00",
          source: "#DBhQqunVsW5BE5wr",
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-observationresults"],
        },
        identifier: [
          {
            system: "urn:ietf:rfc:3986",
            value: "urn:uuid:9d6b6820-f3fe-11ed-9543-d327957cccb9",
          },
        ],
        status: "final",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "laboratory",
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: "http://loinc.org",
            },
          ],
        },
        subject: {
          reference: `Patient/${orgId}.2.101`,
        },
        effectiveDateTime: "2022-07-20T18:19:50.000Z",
        valueString: "neg",
      },
      search: {
        mode: "match",
      },
    },
    {
      fullUrl: `https://api.metriport.com/oauth/fhir/${cxId}/Observation/72573c79-0a15-38b4-9a5e-f8a70dae5191`,
      resource: {
        resourceType: "Observation",
        id: "72573c79-0a15-38b4-9a5e-f8a70dae5191",
        meta: {
          versionId: "1",
          lastUpdated: "2023-04-16T22:04:36.324+00:00",
          source: "#DBhQqunVsW5BE5wr",
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-observationresults"],
        },
        identifier: [
          {
            system: "urn:ietf:rfc:3986",
            value: "urn:uuid:9d6b9b7e-f3fe-11ed-b696-d327957cccb9",
          },
        ],
        status: "final",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "laboratory",
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: "http://loinc.org",
            },
          ],
        },
        subject: {
          reference: `Patient/${orgId}.2.101`,
        },
        effectiveDateTime: "2022-07-20T18:19:50.000Z",
        valueString: "neg",
      },
      search: {
        mode: "match",
      },
    },
    {
      fullUrl: `https://api.metriport.com/oauth/fhir/${cxId}/Observation/54661e49-8d7c-369c-9297-a21fbb8b6415`,
      resource: {
        resourceType: "Observation",
        id: "54661e49-8d7c-369c-9297-a21fbb8b6415",
        meta: {
          versionId: "1",
          lastUpdated: "2023-04-16T22:04:36.394+00:00",
          source: "#DBhQqunVsW5BE5wr",
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-observationresults"],
        },
        identifier: [
          {
            system: "urn:ietf:rfc:3986",
            value: "urn:uuid:9d6bce0a-f3fe-11ed-ace6-d327957cccb9",
          },
        ],
        status: "final",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "laboratory",
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: "http://loinc.org",
            },
          ],
        },
        subject: {
          reference: `Patient/${orgId}.2.101`,
        },
        effectiveDateTime: "2022-07-20T18:19:50.000Z",
        valueString: "neg",
      },
      search: {
        mode: "match",
      },
    },
    {
      fullUrl: `https://api.metriport.com/oauth/fhir/${cxId}/Observation/3cdc56a7-a4c5-3035-a323-fee2b499abb1`,
      resource: {
        resourceType: "Observation",
        id: "3cdc56a7-a4c5-3035-a323-fee2b499abb1",
        meta: {
          versionId: "1",
          lastUpdated: "2023-04-16T22:04:36.447+00:00",
          source: "#DBhQqunVsW5BE5wr",
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-observationresults"],
        },
        identifier: [
          {
            system: "urn:ietf:rfc:3986",
            value: "urn:uuid:9d6c00c8-f3fe-11ed-b94a-d327957cccb9",
          },
        ],
        status: "final",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "laboratory",
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: "http://loinc.org",
            },
          ],
        },
        subject: {
          reference: `Patient/${orgId}.2.101`,
        },
        effectiveDateTime: "2022-07-20T18:19:50.000Z",
        valueString: "neg",
      },
      search: {
        mode: "match",
      },
    },
    {
      fullUrl: `https://api.metriport.com/oauth/fhir/${cxId}/Observation/6e00cd41-4385-33d3-b38d-685fdee638d6`,
      resource: {
        resourceType: "Observation",
        id: "6e00cd41-4385-33d3-b38d-685fdee638d6",
        meta: {
          versionId: "1",
          lastUpdated: "2023-04-16T22:04:36.506+00:00",
          source: "#DBhQqunVsW5BE5wr",
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-observationresults"],
        },
        identifier: [
          {
            system: "urn:ietf:rfc:3986",
            value: "urn:uuid:9d6c3214-f3fe-11ed-93b8-d327957cccb9",
          },
        ],
        status: "final",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "laboratory",
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: "http://loinc.org",
            },
          ],
        },
        subject: {
          reference: `Patient/${orgId}.2.101`,
        },
        effectiveDateTime: "2022-07-20T18:19:50.000Z",
        valueString: "neg",
      },
      search: {
        mode: "match",
      },
    },
    {
      fullUrl: `https://api.metriport.com/oauth/fhir/${cxId}/Observation/7bef0822-7ea9-3dbc-8b74-a5c065a9b8e0`,
      resource: {
        resourceType: "Observation",
        id: "7bef0822-7ea9-3dbc-8b74-a5c065a9b8e0",
        meta: {
          versionId: "1",
          lastUpdated: "2023-04-16T22:04:36.565+00:00",
          source: "#DBhQqunVsW5BE5wr",
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-observationresults"],
        },
        identifier: [
          {
            system: "urn:ietf:rfc:3986",
            value: "urn:uuid:9d71e79a-f3fe-11ed-90ec-d327957cccb9",
          },
        ],
        status: "final",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "social-history",
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: "urn:oid:2.16.840.1.113883.5.4",
              code: "ASSERTION",
            },
          ],
        },
        subject: {
          reference: `Patient/${orgId}.2.101`,
        },
        valueCodeableConcept: {
          coding: [
            {
              system: "http://snomed.info/sct",
              code: "266927001",
              display: "Unknown If Ever Smoked",
            },
          ],
        },
      },
      search: {
        mode: "match",
      },
    },
    {
      fullUrl: `https://api.metriport.com/oauth/fhir/${cxId}/Observation/5dcfd62e-72a1-3894-aaea-774c0a1377ee`,
      resource: {
        resourceType: "Observation",
        id: "5dcfd62e-72a1-3894-aaea-774c0a1377ee",
        meta: {
          versionId: "1",
          lastUpdated: "2023-04-16T22:04:36.680+00:00",
          source: "#DBhQqunVsW5BE5wr",
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-observationresults"],
        },
        identifier: [
          {
            system: "urn:ietf:rfc:3986",
            value: "urn:uuid:9d736d4a-f3fe-11ed-9877-d327957cccb9",
          },
        ],
        status: "final",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "vital-signs",
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "8302-2",
              display: "Height",
            },
          ],
        },
        subject: {
          reference: `Patient/${orgId}.2.101`,
        },
        effectiveDateTime: "2022-07-20",
        valueQuantity: {
          value: 51.5,
          unit: "[in_i]",
        },
      },
      search: {
        mode: "match",
      },
    },
    {
      fullUrl: `https://api.metriport.com/oauth/fhir/${cxId}/Observation/34d2681a-fad0-3887-b2c4-09376c7ea2b6`,
      resource: {
        resourceType: "Observation",
        id: "34d2681a-fad0-3887-b2c4-09376c7ea2b6",
        meta: {
          versionId: "1",
          lastUpdated: "2023-04-16T22:04:36.766+00:00",
          source: "#DBhQqunVsW5BE5wr",
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-observationresults"],
        },
        identifier: [
          {
            system: "urn:ietf:rfc:3986",
            value: "urn:uuid:9d73ad78-f3fe-11ed-9195-d327957cccb9",
          },
        ],
        status: "final",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "vital-signs",
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "39156-5",
              display: "BMI (Body Mass Index)",
            },
          ],
        },
        subject: {
          reference: `Patient/${orgId}.2.101`,
        },
        effectiveDateTime: "2022-07-20",
        valueQuantity: {
          value: 17,
          unit: "kg/m2",
        },
      },
      search: {
        mode: "match",
      },
    },
    {
      fullUrl: `https://api.metriport.com/oauth/fhir/${cxId}/Procedure/4004b588-53eb-3fa7-b483-842190970487`,
      resource: {
        resourceType: "Procedure",
        id: "4004b588-53eb-3fa7-b483-842190970487",
        meta: {
          versionId: "1",
          lastUpdated: "2023-04-16T22:04:36.986+00:00",
          source: "#DBhQqunVsW5BE5wr",
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-procedure"],
        },
        identifier: [
          {
            system: "urn:ietf:rfc:3986",
            value: "urn:uuid:9d67ac8a-f3fe-11ed-8ccb-d327957cccb9",
          },
        ],
        status: "in-progress",
        subject: {
          reference: `Patient/${orgId}.2.101`,
        },
      },
      search: {
        mode: "match",
      },
    },
  ];
}
